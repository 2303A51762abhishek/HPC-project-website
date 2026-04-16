import express from 'express';
import User from '../models/User.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find()
      .select('username email phone role createdAt lastLogin')
      .lean();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

export default router;
