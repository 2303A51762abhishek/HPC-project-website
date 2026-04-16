import { v2 as cloudinary } from 'cloudinary';

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

// Configure Cloudinary from environment
cloudinary.config({
  cloud_name: required('CLOUDINARY_CLOUD_NAME'),
  api_key: required('CLOUDINARY_API_KEY'),
  api_secret: required('CLOUDINARY_API_SECRET'),
  secure: String(process.env.CLOUDINARY_SECURE || 'true') !== 'false',
});

export const uploadImageDataUri = async (dataUri, options = {}) => {
  const folder = options.folder || process.env.CLOUDINARY_FOLDER || 'ev';
  const uploadOptions = {
    folder,
    resource_type: 'image',
    overwrite: false,
    invalidate: false,
  };
  const res = await cloudinary.uploader.upload(dataUri, uploadOptions);
  return res;
};

// Extract public_id from Cloudinary URL
// e.g., https://res.cloudinary.com/do92glakz/image/upload/v123/ev/abc.jpg -> ev/abc
export const extractPublicId = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  // Match Cloudinary URL pattern - extract everything between /upload/ and the file extension
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)$/);
  if (!match) return null;
  
  // Remove file extension (.jpg, .png, etc.)
  const fullPath = match[1];
  const withoutExtension = fullPath.replace(/\.\w+$/, '');
  
  return withoutExtension;
};

// Delete a single image from Cloudinary by URL or public_id
export const deleteImage = async (urlOrPublicId) => {
  try {
    let publicId = urlOrPublicId;
    
    // If it looks like a URL, extract the public_id
    if (urlOrPublicId.startsWith('http')) {
      publicId = extractPublicId(urlOrPublicId);
      console.log(`[Cloudinary] Extracted public_id: "${publicId}" from URL: ${urlOrPublicId}`);
    }
    
    if (!publicId) {
      console.warn('[Cloudinary] Could not extract public_id from:', urlOrPublicId);
      return { result: 'error', reason: 'invalid_public_id' };
    }
    
    console.log(`[Cloudinary] Attempting to delete image with public_id: "${publicId}"`);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`[Cloudinary] Delete result:`, result);
    
    return result;
  } catch (error) {
    console.error('[Cloudinary] Error deleting image:', error.message);
    return { result: 'error', reason: error.message };
  }
};

// Delete multiple images from Cloudinary
export const deleteImages = async (urlsOrPublicIds) => {
  if (!Array.isArray(urlsOrPublicIds)) {
    console.warn('[Cloudinary] deleteImages called with non-array:', typeof urlsOrPublicIds);
    return [];
  }
  
  const validUrls = urlsOrPublicIds.filter(Boolean);
  console.log(`[Cloudinary] Deleting ${validUrls.length} images...`);
  
  const deletePromises = validUrls.map(url => deleteImage(url));
  
  const results = await Promise.allSettled(deletePromises);
  
  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.result === 'ok').length;
  const failed = results.length - succeeded;
  console.log(`[Cloudinary] Batch delete complete: ${succeeded} succeeded, ${failed} failed`);
  
  return results;
};

export default cloudinary;
