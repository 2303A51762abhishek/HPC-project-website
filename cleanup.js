import express from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import cleanupUnusedImages from '../utils/cleanupUnusedImages.js';

const router = express.Router();

// Manual cleanup trigger (admin only)
router.post('/cleanup-images', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { dryRun = true, folder = 'ev' } = req.body;

    console.log(`[Cleanup Job] Started by admin. DryRun: ${dryRun}`);

    const result = await cleanupUnusedImages({ dryRun, folder });

    res.json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Cleanup completed',
      ...result
    });
  } catch (error) {
    console.error('[Cleanup Job] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Cleanup failed',
      error: error.message
    });
  }
});

// Scheduled cleanup (can be called by external cron service like Azure Scheduler)
router.post('/scheduled-cleanup', async (req, res) => {
  try {
    // Verify secret key for external cron services
    const secretKey = req.headers['x-cleanup-secret'];
    if (secretKey !== process.env.CLEANUP_SECRET_KEY) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('[Scheduled Cleanup] Running automated cleanup...');

    const result = await cleanupUnusedImages({ 
      dryRun: false, // Live cleanup for scheduled jobs
      folder: 'ev' 
    });

    res.json({
      success: true,
      message: 'Scheduled cleanup completed',
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    console.error('[Scheduled Cleanup] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Scheduled cleanup failed',
      error: error.message
    });
  }
});

// Get cleanup statistics (admin only)
router.get('/cleanup-stats', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Run dry run to get stats without deleting
    const result = await cleanupUnusedImages({ dryRun: true, folder: 'ev' });

    res.json({
      success: true,
      stats: {
        unusedCount: result.unusedImages.length,
        totalSize: result.unusedImages.reduce((sum, img) => sum + (img.bytes || 0), 0),
        images: result.unusedImages
      }
    });
  } catch (error) {
    console.error('[Cleanup Stats] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cleanup stats',
      error: error.message
    });
  }
});

export default router;
