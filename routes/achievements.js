import express from 'express';
import { achievementStorage } from '../utils/dbStorage.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { deleteImage } from '../utils/cloudinary.js';

const router = express.Router();

// GET /api/achievements - Get all achievements
router.get('/', async (req, res) => {
  try {
    const { limit = 100, featured } = req.query;
    
    // Build query filters
    const filters = {};
    if (featured === 'true') {
      filters.featured = true;
    }

    // Execute query at database level
    const achievements = await achievementStorage.find(filters)
      .limit(parseInt(limit) || 100)
      .lean()
      .exec();

    // Return only minimal fields in API response
    const sanitized = achievements.map(a => ({
      _id: a._id,
      image: a.image,
      featured: !!a.featured,
      isActive: a.isActive !== false,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ message: 'Failed to fetch achievements' });
  }
});

// GET /api/achievements/:id - Get single achievement
router.get('/:id', async (req, res) => {
  try {
    const achievement = await achievementStorage.getById(req.params.id);
    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }
    res.json(achievement);
  } catch (error) {
    console.error('Error fetching achievement:', error);
    res.status(500).json({ message: 'Failed to fetch achievement' });
  }
});

// POST /api/achievements - Create new achievement
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Whitelist only allowed fields for image-only achievements
    const allowed = ['image', 'featured', 'isActive'];
    const extraKeys = Object.keys(req.body || {}).filter(k => !allowed.includes(k));

    if (extraKeys.length > 0) {
      return res.status(400).json({
        message: `Unexpected fields: ${extraKeys.join(', ')}. Allowed fields are: ${allowed.join(', ')}`
      });
    }

    const { image, featured = false, isActive = true } = req.body || {};

    if (!image || typeof image !== 'string' || image.trim() === '') {
      return res.status(400).json({ message: 'Image is required' });
    }

    const achievementData = { image: image.trim(), featured, isActive };

    const achievement = await achievementStorage.create(achievementData);
    res.status(201).json(achievement);
  } catch (error) {
    console.error('Error creating achievement:', error);
    // Surface validation errors clearly
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error?.name === 'CastError') {
      return res.status(400).json({ message: `Invalid value for ${error.path}` });
    }
    res.status(500).json({ message: 'Failed to create achievement' });
  }
});

// PUT /api/achievements/:id - Update achievement
router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Whitelist only allowed fields and reject unexpected ones
    const allowed = ['image', 'featured', 'isActive'];
    const extraKeys = Object.keys(req.body || {}).filter(k => !allowed.includes(k));
    if (extraKeys.length > 0) {
      return res.status(400).json({
        message: `Unexpected fields: ${extraKeys.join(', ')}. Allowed fields are: ${allowed.join(', ')}`
      });
    }

    const update = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'image')) {
      const img = req.body.image;
      if (!img || typeof img !== 'string' || img.trim() === '') {
        return res.status(400).json({ message: 'Image cannot be empty' });
      }
      update.image = img.trim();
      
      // Delete old image if it's being replaced
      const existingAchievement = await achievementStorage.getById(req.params.id);
      if (existingAchievement && existingAchievement.image && 
          existingAchievement.image !== update.image) {
        console.log('[Achievement Update] Deleting replaced image');
        deleteImage(existingAchievement.image).catch(err => 
          console.error('Error cleaning up old achievement image:', err)
        );
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'featured')) {
      update.featured = !!req.body.featured;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'isActive')) {
      update.isActive = !!req.body.isActive;
    }
    update.updatedAt = new Date().toISOString();

    const achievement = await achievementStorage.update(req.params.id, update);
    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }
    res.json(achievement);
  } catch (error) {
    console.error('Error updating achievement:', error);
    res.status(500).json({ message: 'Failed to update achievement' });
  }
});

// DELETE /api/achievements/:id - Delete achievement
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Get achievement to extract image before deletion
    const achievement = await achievementStorage.getById(req.params.id);
    if (!achievement) {
      return res.status(404).json({ message: 'Achievement not found' });
    }

    // Delete achievement from database
    const success = await achievementStorage.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: 'Achievement not found' });
    }

    // Delete image from Cloudinary if it exists (async, don't block)
    if (achievement.image) {
      deleteImage(achievement.image).catch(err => 
        console.error('Error cleaning up Cloudinary image:', err)
      );
    }

    res.json({ message: 'Achievement deleted successfully' });
  } catch (error) {
    console.error('Error deleting achievement:', error);
    res.status(500).json({ message: 'Failed to delete achievement' });
  }
});

export default router;
