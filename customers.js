import express from 'express';
import { customerStorage } from '../utils/dbStorage.js';
import { body, validationResult } from 'express-validator';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all customers with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      customerStorage.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      customerStorage.count({})
    ]);

    res.json({
      customers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalCustomers: total,
        hasNextPage: skip + limit < total,
        hasPrevPage: skip > 0
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const customer = await customerStorage.getById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ message: 'Error fetching customer', error: error.message });
  }
});

// Create new customer
router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('city').optional().isString(),
  body('vehicleName').notEmpty().withMessage('Vehicle name is required'),
  body('amount').isNumeric().withMessage('Amount is required and must be numeric'),
  body('purchaseDate').notEmpty().withMessage('Purchase date is required').isISO8601().toDate(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const customerData = {
      name: req.body.name,
      phone: req.body.phone,
      city: req.body.city || undefined,
      vehicleName: req.body.vehicleName,
      amount: Number(req.body.amount),
      purchaseDate: new Date(req.body.purchaseDate)
    };

    const customer = await customerStorage.create(customerData);
    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
});

// Update customer
router.put('/:id', [
  verifyToken,
  requireRole('admin'),
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('city').optional().isString(),
  body('vehicleName').notEmpty().withMessage('Vehicle name is required'),
  body('amount').isNumeric().withMessage('Amount is required and must be numeric'),
  body('purchaseDate').notEmpty().withMessage('Purchase date is required').isISO8601().toDate(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const customerData = {
      name: req.body.name,
      phone: req.body.phone,
      city: req.body.city || undefined,
      vehicleName: req.body.vehicleName,
      amount: Number(req.body.amount),
      purchaseDate: new Date(req.body.purchaseDate)
    };

    const customer = await customerStorage.update(req.params.id, customerData);
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.status(500).json({ message: 'Error updating customer', error: error.message });
  }
});

// Delete customer
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await customerStorage.delete(req.params.id);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.status(500).json({ message: 'Error deleting customer', error: error.message });
  }
});

// Add purchase to customer
router.post('/:id/purchases', async (req, res) => {
  try {
    return res.status(410).json({ message: 'This endpoint is no longer supported. Purchases are created with customers.' });
  } catch (error) {
    console.error('Error adding purchase:', error);
    res.status(500).json({ message: 'Error adding purchase', error: error.message });
  }
});

// Schedule test drive
router.post('/:id/test-drives', async (req, res) => {
  try {
    return res.status(410).json({ message: 'This endpoint is no longer supported.' });
  } catch (error) {
    console.error('Error scheduling test drive:', error);
    res.status(500).json({ message: 'Error scheduling test drive', error: error.message });
  }
});

// Update test drive status
router.patch('/:id/test-drives/:testDriveId', async (req, res) => {
  try {
    return res.status(410).json({ message: 'This endpoint is no longer supported.' });
  } catch (error) {
    console.error('Error updating test drive status:', error);
    res.status(500).json({ message: 'Error updating test drive status', error: error.message });
  }
});// Get customer statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const customers = await customerStorage.getAll();
    
    const stats = {
      total: customers.length,
      totalRevenue: customers.reduce((sum, c) => sum + (c.amount || 0), 0),
      averageAmount: customers.length > 0 ? customers.reduce((sum, c) => sum + (c.amount || 0), 0) / customers.length : 0
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({ message: 'Error fetching customer stats', error: error.message });
  }
});

export default router;