import mongoose from 'mongoose';

// Minimal image-only achievement schema
// Deprecated/removed fields: title, descriptions, category, images, icon, issuer, location, tags, date
// Existing documents may still contain those fields in MongoDB, but API responses/routes
// only create/update and surface: image, featured, isActive.
const achievementSchema = new mongoose.Schema({
  image: {
    type: String,
    required: true,
    trim: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

achievementSchema.index({ featured: 1 });
achievementSchema.index({ isActive: 1 });

const Achievement = mongoose.model('Achievement', achievementSchema);

export default Achievement;
