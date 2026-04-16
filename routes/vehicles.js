import express from 'express';
import { vehicleStorage } from '../utils/dbStorage.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { deleteImages } from '../utils/cloudinary.js';

const router = express.Router();

// Get all vehicles with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      brand,
      minPrice,
      maxPrice,
      featured,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build MongoDB query filters
    const filters = {};
    if (category) filters.category = category;
    if (brand) filters.brand = brand;
    if (featured !== undefined) filters.featured = featured === 'true';
    
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.$gte = parseFloat(minPrice);
      if (maxPrice) filters.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filters.$or = [
        { name: { $regex: searchLower, $options: 'i' } },
        { brand: { $regex: searchLower, $options: 'i' } },
        { description: { $regex: searchLower, $options: 'i' } }
      ];
    }

    // Build sort object for MongoDB
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Execute query with database-level filtering, sorting, and pagination
    const [vehicles, totalVehicles] = await Promise.all([
      vehicleStorage.find(filters)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      vehicleStorage.count(filters)
    ]);

    res.json({
      vehicles,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalVehicles / limitNum),
        totalVehicles,
        hasNextPage: skip + limitNum < totalVehicles,
        hasPrevPage: skip > 0
      }
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ message: 'Error fetching vehicles', error: error.message });
  }
});

// Get vehicle by ID
router.get('/:id', async (req, res) => {
  try {
    const vehicle = await vehicleStorage.getById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ message: 'Error fetching vehicle', error: error.message });
  }
});

// Create new vehicle
router.post('/', verifyToken, requireRole('admin'), [
  body('name').notEmpty().withMessage('Vehicle name is required'),
  body('brand').notEmpty().withMessage('Brand is required'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 2 }).withMessage('Invalid year')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const vehicleData = {
      ...req.body,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      featured: req.body.featured !== undefined ? req.body.featured : false,
      inventory: req.body.inventory || {
        stock: 0,
        reserved: 0,
        status: 'available'
      }
    };

    const vehicle = await vehicleStorage.create(vehicleData);
    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ message: 'Error creating vehicle', error: error.message });
  }
});

// Update vehicle
router.put('/:id', verifyToken, requireRole('admin'), [
  body('name').optional().notEmpty().withMessage('Vehicle name cannot be empty'),
  body('brand').optional().notEmpty().withMessage('Brand cannot be empty'),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 2 }).withMessage('Invalid year')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get existing vehicle to check for replaced images
    const existingVehicle = await vehicleStorage.getById(req.params.id);
    if (!existingVehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // Track images that are being removed/replaced
    const imagesToDelete = [];

    // Check if main images are being replaced
    if (req.body.images && Array.isArray(req.body.images)) {
      const oldImages = existingVehicle.images || [];
      const newImages = req.body.images;
      const removedImages = oldImages.filter(img => !newImages.includes(img));
      imagesToDelete.push(...removedImages);
    }

    // Check if color images are being replaced
    if (req.body.colorImages && Array.isArray(req.body.colorImages)) {
      const oldColorImages = existingVehicle.colorImages || [];
      const newColorImages = req.body.colorImages;
      
      oldColorImages.forEach(oldColor => {
        const stillExists = newColorImages.some(newColor => 
          newColor.color === oldColor.color
        );
        
        if (!stillExists) {
          // Entire color removed, delete all its images
          if (oldColor.primaryImage) imagesToDelete.push(oldColor.primaryImage);
          if (oldColor.images) imagesToDelete.push(...oldColor.images);
        } else {
          // Color still exists, check for removed images within it
          const newColor = newColorImages.find(nc => nc.color === oldColor.color);
          
          if (oldColor.primaryImage && oldColor.primaryImage !== newColor.primaryImage) {
            imagesToDelete.push(oldColor.primaryImage);
          }
          
          if (oldColor.images && newColor.images) {
            const removedColorImages = oldColor.images.filter(img => !newColor.images.includes(img));
            imagesToDelete.push(...removedColorImages);
          }
        }
      });
    }

    // Update vehicle
    const vehicle = await vehicleStorage.update(req.params.id, req.body);

    // Delete old images from Cloudinary (async, don't block response)
    if (imagesToDelete.length > 0) {
      console.log(`[Vehicle Update] Cleaning up ${imagesToDelete.length} replaced images`);
      deleteImages(imagesToDelete).catch(err => 
        console.error('Error cleaning up replaced Cloudinary images:', err)
      );
    }

    res.json(vehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    res.status(500).json({ message: 'Error updating vehicle', error: error.message });
  }
});

// Delete vehicle
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Get vehicle to extract image URLs before deletion
    const vehicle = await vehicleStorage.getById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    // Collect all image URLs to delete from Cloudinary
    const imagesToDelete = [];
    
    // Add main images
    if (vehicle.images && Array.isArray(vehicle.images)) {
      imagesToDelete.push(...vehicle.images);
    }
    
    // Add color-specific images
    if (vehicle.colorImages && Array.isArray(vehicle.colorImages)) {
      vehicle.colorImages.forEach(colorImg => {
        if (colorImg.primaryImage) imagesToDelete.push(colorImg.primaryImage);
        if (colorImg.images && Array.isArray(colorImg.images)) {
          imagesToDelete.push(...colorImg.images);
        }
      });
    }

    // Delete vehicle from database
    await vehicleStorage.delete(req.params.id);

    // Delete images from Cloudinary (async, don't block response)
    if (imagesToDelete.length > 0) {
      deleteImages(imagesToDelete).catch(err => 
        console.error('Error cleaning up Cloudinary images:', err)
      );
    }

    res.json({ 
      message: 'Vehicle deleted successfully',
      imagesCleanedUp: imagesToDelete.length 
    });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    res.status(500).json({ message: 'Error deleting vehicle', error: error.message });
  }
});

// Update vehicle inventory
router.patch('/:id/inventory', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { stock, reserved, status } = req.body;
    const inventoryData = { inventory: { stock, reserved, status } };
    
    const vehicle = await vehicleStorage.update(req.params.id, inventoryData);
    res.json(vehicle);
  } catch (error) {
    console.error('Error updating vehicle inventory:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    res.status(500).json({ message: 'Error updating vehicle inventory', error: error.message });
  }
});

// Get vehicle statistics
router.get('/stats/overview', async (req, res) => {
  try {
    // Use MongoDB aggregation pipeline for efficient stats
    const Vehicle = vehicleStorage.getModel();
    const stats = await Vehicle.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $ne: ['$isActive', false] }, 1, 0] }
          },
          featured: {
            $sum: { $cond: ['$featured', 1, 0] }
          },
          totalValue: { $sum: '$price' },
          avgPrice: { $avg: '$price' },
          byCategory: {
            $push: '$category'
          },
          byBrand: {
            $push: '$brand'
          }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          active: 1,
          featured: 1,
          totalValue: 1,
          averagePrice: '$avgPrice',
          categories: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: '$byCategory' },
                as: 'cat',
                in: {
                  k: '$$cat',
                  v: {
                    $size: {
                      $filter: {
                        input: '$byCategory',
                        as: 'item',
                        cond: { $eq: ['$$item', '$$cat'] }
                      }
                    }
                  }
                }
              }
            }
          },
          brands: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: '$byBrand' },
                as: 'br',
                in: {
                  k: '$$br',
                  v: {
                    $size: {
                      $filter: {
                        input: '$byBrand',
                        as: 'item',
                        cond: { $eq: ['$$item', '$$br'] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      active: 0,
      featured: 0,
      totalValue: 0,
      averagePrice: 0,
      categories: {},
      brands: {}
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching vehicle stats:', error);
    res.status(500).json({ message: 'Error fetching vehicle stats', error: error.message });
  }
});

export default router;