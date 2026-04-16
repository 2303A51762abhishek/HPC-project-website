import express from 'express';
import { body, validationResult } from 'express-validator';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { uploadImageDataUri } from '../utils/cloudinary.js';

const router = express.Router();

// Upload an image (expects base64 data URL)
router.post(
  '/image',
  verifyToken,
  requireRole('admin'),
  [body('image').isString().notEmpty().withMessage('image (data URL) is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { image, folder } = req.body;

      // Basic guard: must be data URL
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(image)) {
        return res.status(400).json({ message: 'Invalid image format. Expecting data URL (base64)' });
      }

      // Check size (rough estimate: base64 is ~1.37x original)
      const base64Data = image.split(',')[1];
      const sizeInBytes = (base64Data.length * 0.75);
      const maxSizeBytes = (process.env.MAX_UPLOAD_SIZE_MB || 5) * 1024 * 1024;
      
      if (sizeInBytes > maxSizeBytes) {
        return res.status(413).json({ 
          message: `Image too large (${(sizeInBytes / (1024*1024)).toFixed(1)}MB). Max: ${(maxSizeBytes / (1024*1024))}MB. Please reduce image quality or dimensions.` 
        });
      }

      const result = await uploadImageDataUri(image, { folder });

      return res.status(201).json({
        url: result.secure_url || result.url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      });
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
      return res.status(500).json({ message: 'Image upload failed', error: error.message });
    }
  }
);

export default router;
