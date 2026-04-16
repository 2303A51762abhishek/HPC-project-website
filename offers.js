import express from 'express';
import { offerStorage, vehicleStorage } from '../utils/dbStorage.js';
import { body, validationResult } from 'express-validator';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { deleteImage } from '../utils/cloudinary.js';

const router = express.Router();

// Get all offers
router.get('/', async (req, res) => {
  try {
    const { limit = 100, active } = req.query;
    let offers = await offerStorage.getAll();

    // Filter active offers if requested
    if (active === 'true') {
      const now = new Date();
      offers = offers.filter(offer => {
        if (!offer.isActive) return false;
        if (!offer.validUntil) return true;
        return new Date(offer.validUntil) > now;
      });
    }

    // Sort by creation date (newest first)
    offers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply limit
    if (limit) {
      offers = offers.slice(0, parseInt(limit));
    }

    res.json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ message: 'Error fetching offers', error: error.message });
  }
});

// Get offer by ID
router.get('/:id', async (req, res) => {
  try {
    const offer = await offerStorage.getById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    res.json(offer);
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ message: 'Error fetching offer', error: error.message });
  }
});

// Create new offer
router.post('/', verifyToken, requireRole('admin'), [
  body('title').notEmpty().withMessage('Offer title is required'),
  body('discount').optional().isNumeric().withMessage('Discount must be a number'),
  body('sellingPrice').optional().isNumeric().withMessage('Selling price must be a number'),
  body('bannerType').optional().isIn(['general', 'vehicle']).withMessage('Banner type must be general or vehicle')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const bannerType = req.body.bannerType || 'vehicle';

    // Validate based on banner type
    if (bannerType === 'vehicle') {
      // Vehicle offer requires vehicleId and either discount or sellingPrice
      if (!req.body.vehicleId) {
        return res.status(400).json({ message: 'Vehicle ID is required for vehicle offers' });
      }
      
      // Check that at least one pricing option is provided
      const hasDiscount = req.body.discount !== undefined && req.body.discount !== null;
      const hasSellingPrice = req.body.sellingPrice !== undefined && req.body.sellingPrice !== null;
      
      if (!hasDiscount && !hasSellingPrice) {
        return res.status(400).json({ message: 'Either discount (%) or selling price must be provided for vehicle offers' });
      }

      // Check if vehicle exists
      const vehicle = await vehicleStorage.getById(req.body.vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      // Validate vehicle has images if no custom banner image is provided
      if (!req.body.bannerImageUrl) {
        const hasImages = (vehicle.colorImages && vehicle.colorImages.length > 0 && 
                          vehicle.colorImages.some(ci => ci.images && ci.images.length > 0)) ||
                          (vehicle.images && vehicle.images.length > 0);
        
        if (!hasImages) {
          return res.status(400).json({ 
            message: 'Cannot create offer: Vehicle has no images. Please add vehicle images first or provide a custom banner image.' 
          });
        }
      }

      // Check if there's already an active offer for this vehicle
      const isActiveOffer = req.body.isActive !== false; // Default to true
      if (isActiveOffer) {
        // Use DB-level filtering to avoid ObjectId vs string comparison issues
        const conflictCount = await offerStorage.count({
          vehicleId: req.body.vehicleId,
          isActive: true
        });
        if (conflictCount > 0) {
          return res.status(400).json({ 
            message: 'This vehicle already has an active offer. Please deactivate the existing offer first or create this offer as inactive.' 
          });
        }
      }
    } else {
      // General campaign requires banner image
      if (!req.body.bannerImageUrl) {
        return res.status(400).json({ message: 'Banner image is required for general campaign banners' });
      }
    }

    const offerData = {
      ...req.body,
      bannerType: bannerType,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      validFrom: req.body.validFrom || new Date().toISOString(),
      validUntil: req.body.validUntil || undefined
    };

    const offer = await offerStorage.create(offerData);
    res.status(201).json(offer);
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ message: 'Error creating offer', error: error.message });
  }
});

// Update offer
router.put('/:id', verifyToken, requireRole('admin'), [
  body('title').optional().trim().notEmpty().withMessage('Offer title cannot be empty'),
  body('discount').optional().isNumeric().withMessage('Discount must be a number'),
  body('sellingPrice').optional().isNumeric().withMessage('Selling price must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('[Offer Update] Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    console.log('[Offer Update] Updating offer with ID:', req.params.id);
    console.log('[Offer Update] Request body:', req.body);

    // Get the existing offer to check its vehicleId
    const existingOffer = await offerStorage.getById(req.params.id);
    if (!existingOffer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    // If trying to activate an offer for a vehicle, check if another active offer exists
    const isActivating = req.body.isActive === true;
    const vehicleId = req.body.vehicleId || existingOffer.vehicleId;
    
    if (isActivating && vehicleId) {
      const conflictCount = await offerStorage.count({
        vehicleId,
        isActive: true,
        _id: { $ne: req.params.id }
      });
      if (conflictCount > 0) {
        return res.status(400).json({ 
          message: 'This vehicle already has an active offer. Please deactivate the existing offer first.' 
        });
      }
    }

    // Check if banner image is being replaced
    if (req.body.bannerImageUrl && existingOffer.bannerImageUrl && 
        req.body.bannerImageUrl !== existingOffer.bannerImageUrl) {
      // Delete old banner image from Cloudinary (async)
      console.log('[Offer Update] Deleting replaced banner image');
      deleteImage(existingOffer.bannerImageUrl).catch(err => 
        console.error('Error cleaning up old banner image:', err)
      );
    }

    const offer = await offerStorage.update(req.params.id, req.body);
    console.log('[Offer Update] Successfully updated offer:', { id: offer._id, discount: offer.discount });
    res.json(offer);
  } catch (error) {
    console.error('Error updating offer:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    res.status(500).json({ message: 'Error updating offer', error: error.message });
  }
});

// Delete offer
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Get offer to extract banner image before deletion
    const offer = await offerStorage.getById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    // Delete offer from database
    await offerStorage.delete(req.params.id);

    // Delete banner image from Cloudinary if it exists (async, don't block)
    if (offer.bannerImageUrl) {
      deleteImage(offer.bannerImageUrl).catch(err => 
        console.error('Error cleaning up Cloudinary image:', err)
      );
    }

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    res.status(500).json({ message: 'Error deleting offer', error: error.message });
  }
});

// Toggle offer active status
router.patch('/:id/toggle', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const offer = await offerStorage.getById(req.params.id);
    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    // If trying to activate an offer for a vehicle, check if another active offer exists
    const willBeActive = !offer.isActive;
    
    if (willBeActive && offer.vehicleId) {
      const conflictCount = await offerStorage.count({
        vehicleId: offer.vehicleId,
        isActive: true,
        _id: { $ne: req.params.id }
      });
      if (conflictCount > 0) {
        return res.status(400).json({ 
          message: 'This vehicle already has an active offer. Please deactivate the existing offer first.' 
        });
      }
    }

    const updatedOffer = await offerStorage.update(req.params.id, {
      isActive: willBeActive
    });

    res.json(updatedOffer);
  } catch (error) {
    console.error('Error toggling offer:', error);
    res.status(500).json({ message: 'Error toggling offer', error: error.message });
  }
});

// Get active offers for a specific vehicle
router.get('/vehicle/:vehicleId/active', async (req, res) => {
  try {
    const offers = await offerStorage.find({
      vehicleId: req.params.vehicleId,
      isActive: true
    });

    // Filter by validity date
    const now = new Date();
    const activeOffers = offers.filter(offer => {
      if (!offer.validUntil) return true;
      return new Date(offer.validUntil) > now;
    });

    res.json(activeOffers);
  } catch (error) {
    console.error('Error fetching active offers for vehicle:', error);
    res.status(500).json({ message: 'Error fetching active offers', error: error.message });
  }
});

// Get offer statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const offers = await offerStorage.getAll();
    const now = new Date();
    
    // Create a map for O(1) vehicle lookups instead of O(n) search
    const vehicleMap = new Map();
    const vehicles = await vehicleStorage.getAll();
    vehicles.forEach(v => vehicleMap.set(v._id.toString(), v));
    
    const stats = {
      total: offers.length,
      active: offers.filter(o => o.isActive).length,
      expired: offers.filter(o => o.validUntil && new Date(o.validUntil) < now).length,
      averageDiscount: offers.length > 0 ? offers.reduce((sum, o) => sum + (o.discount || 0), 0) / offers.length : 0,
      totalSavings: offers.reduce((sum, o) => {
        const vehicle = vehicleMap.get(o.vehicleId?.toString());
        return sum + ((vehicle?.price || 0) * (o.discount || 0) / 100);
      }, 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching offer stats:', error);
    res.status(500).json({ message: 'Error fetching offer stats', error: error.message });
  }
});

// Helper endpoint: Deactivate all other offers for a vehicle
router.post('/vehicle/:vehicleId/deactivate-others', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { exceptOfferId } = req.body; // Optional: keep one offer active

    // Build criteria with optional exclusion
    const criteria = {
      vehicleId,
      isActive: true
    };
    if (exceptOfferId) {
      criteria._id = { $ne: exceptOfferId };
    }

    const offersToDeactivate = await offerStorage.find(criteria);

    // Deactivate all conflicting offers with updateMany (database-level batch operation)
    const result = await offerStorage.getModel().updateMany(
      criteria,
      { isActive: false }
    );

    res.json({ 
      message: `Deactivated ${result.modifiedCount} offer(s)`,
      deactivatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error deactivating offers:', error);
    res.status(500).json({ message: 'Error deactivating offers', error: error.message });
  }
});

export default router;