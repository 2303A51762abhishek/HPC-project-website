import express from 'express';
import { body, validationResult } from 'express-validator';
import { verifyToken, requireRole } from '../middleware/auth.js';
import ContactQuery from '../models/ContactQuery.js';

const router = express.Router();

// Public endpoint - Submit contact query
router.post('/', [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('subject').notEmpty().trim().withMessage('Subject is required'),
  body('message').notEmpty().trim().withMessage('Message is required'),
  body('inquiryType').optional().isIn(['general', 'sales', 'support', 'feedback', 'test-drive'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, subject, message, inquiryType } = req.body;

    const query = await ContactQuery.create({
      name,
      email,
      phone,
      subject,
      message,
      inquiryType: inquiryType || 'general'
    });

    console.log(`[Contact Query] New query from ${email}`);

    res.status(201).json({
      message: 'Your message has been sent successfully! We\'ll get back to you soon.',
      queryId: query._id
    });
  } catch (error) {
    console.error('Error submitting contact query:', error);
    res.status(500).json({ message: 'Failed to submit query', error: error.message });
  }
});

// Admin - Get all queries
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { status, limit = 100, skip = 0 } = req.query;

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const queries = await ContactQuery.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await ContactQuery.countDocuments(filter);
    const unreadCount = await ContactQuery.countDocuments({ isRead: false });

    res.json({
      queries,
      total,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching contact queries:', error);
    res.status(500).json({ message: 'Failed to fetch queries', error: error.message });
  }
});

// Admin - Get single query
router.get('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const query = await ContactQuery.findById(req.params.id);
    
    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    // Mark as read when admin views it
    if (!query.isRead) {
      query.isRead = true;
      if (query.status === 'new') {
        query.status = 'read';
      }
      await query.save();
    }

    res.json(query);
  } catch (error) {
    console.error('Error fetching contact query:', error);
    res.status(500).json({ message: 'Failed to fetch query', error: error.message });
  }
});

// Admin - Update query status
router.patch('/:id/status', verifyToken, requireRole('admin'), [
  body('status').isIn(['new', 'read', 'responded', 'closed']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;

    const query = await ContactQuery.findByIdAndUpdate(
      req.params.id,
      { status, isRead: true },
      { new: true }
    );

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    res.json(query);
  } catch (error) {
    console.error('Error updating query status:', error);
    res.status(500).json({ message: 'Failed to update status', error: error.message });
  }
});

// Admin - Delete query
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const query = await ContactQuery.findByIdAndDelete(req.params.id);

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    console.log(`[Contact Query] Deleted query from ${query.email}`);

    res.json({ message: 'Query deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact query:', error);
    res.status(500).json({ message: 'Failed to delete query', error: error.message });
  }
});

// Admin - Bulk delete queries
router.post('/bulk-delete', verifyToken, requireRole('admin'), [
  body('ids').isArray().withMessage('IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ids } = req.body;

    const result = await ContactQuery.deleteMany({ _id: { $in: ids } });

    res.json({ 
      message: 'Queries deleted successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting queries:', error);
    res.status(500).json({ message: 'Failed to delete queries', error: error.message });
  }
});

// Admin - Get statistics
router.get('/stats/summary', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const total = await ContactQuery.countDocuments();
    const unread = await ContactQuery.countDocuments({ isRead: false });
    const newQueries = await ContactQuery.countDocuments({ status: 'new' });
    const responded = await ContactQuery.countDocuments({ status: 'responded' });
    const closed = await ContactQuery.countDocuments({ status: 'closed' });

    const byType = await ContactQuery.aggregate([
      { $group: { _id: '$inquiryType', count: { $sum: 1 } } }
    ]);

    res.json({
      total,
      unread,
      byStatus: {
        new: newQueries,
        responded,
        closed
      },
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching query statistics:', error);
    res.status(500).json({ message: 'Failed to fetch statistics', error: error.message });
  }
});

export default router;
