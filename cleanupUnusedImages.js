import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';
import Offer from '../models/Offer.js';
import Achievement from '../models/Achievement.js';

// Configure Cloudinary (will be called after env is loaded)
function configureCloudinary() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

/**
 * Fetches all image URLs from the database
 */
async function getAllDatabaseImages() {
  const allImages = new Set();

  try {
    // Get all vehicle images
    const vehicles = await Vehicle.find({}, 'images colorImages').lean();
    vehicles.forEach(vehicle => {
      // Main images
      if (vehicle.images && Array.isArray(vehicle.images)) {
        vehicle.images.forEach(img => img && allImages.add(img));
      }
      
      // Color-specific images
      if (vehicle.colorImages && Array.isArray(vehicle.colorImages)) {
        vehicle.colorImages.forEach(colorImg => {
          if (colorImg.primaryImage) allImages.add(colorImg.primaryImage);
          if (colorImg.images && Array.isArray(colorImg.images)) {
            colorImg.images.forEach(img => img && allImages.add(img));
          }
        });
      }
    });

    // Get all offer banner images
    const offers = await Offer.find({}, 'bannerImageUrl').lean();
    offers.forEach(offer => {
      if (offer.bannerImageUrl) allImages.add(offer.bannerImageUrl);
    });

    // Get all achievement images
    const achievements = await Achievement.find({}, 'image').lean();
    achievements.forEach(achievement => {
      if (achievement.image) allImages.add(achievement.image);
    });

    console.log(`✅ Found ${allImages.size} images in database`);
    return allImages;
  } catch (error) {
    console.error('Error fetching database images:', error);
    throw error;
  }
}

/**
 * Extracts public_id from Cloudinary URL
 */
function extractPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)$/);
  if (!match) return null;
  
  const fullPath = match[1];
  const withoutExtension = fullPath.replace(/\.\w+$/, '');
  
  return withoutExtension;
}

/**
 * Converts public_id to full Cloudinary URL for comparison
 */
function publicIdToUrl(publicId, cloudName) {
  // Reconstruct the URL pattern used in the database
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
}

/**
 * Fetches all images from Cloudinary folder
 */
async function getAllCloudinaryImages(folder = 'ev') {
  const cloudinaryImages = new Map(); // public_id -> full resource object
  let hasMore = true;
  let nextCursor = null;

  console.log(`📥 Fetching images from Cloudinary folder: ${folder}...`);

  try {
    while (hasMore) {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: 500,
        next_cursor: nextCursor,
      });

      result.resources.forEach(resource => {
        cloudinaryImages.set(resource.public_id, resource);
      });

      hasMore = !!result.next_cursor;
      nextCursor = result.next_cursor;
      
      console.log(`   Fetched ${result.resources.length} images (total: ${cloudinaryImages.size})`);
    }

    console.log(`✅ Found ${cloudinaryImages.size} images in Cloudinary`);
    return cloudinaryImages;
  } catch (error) {
    console.error('Error fetching Cloudinary images:', error);
    throw error;
  }
}

/**
 * Main cleanup function
 */
async function cleanupUnusedImages(options = {}) {
  const { dryRun = true, folder = 'ev' } = options;

  console.log('\n========================================');
  console.log('🧹 Cloudinary Unused Images Cleanup');
  console.log('========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'LIVE (will delete)'}`);
  console.log(`Folder: ${folder}`);
  console.log('========================================\n');

  try {
    // Ensure Cloudinary is configured
    configureCloudinary();
    
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      console.log('📡 Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to MongoDB\n');
    }

    // Step 1: Get all images from database
    const databaseImages = await getAllDatabaseImages();
    
    // Create a set of public_ids from database URLs
    const databasePublicIds = new Set();
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    
    databaseImages.forEach(url => {
      const publicId = extractPublicId(url);
      if (publicId) {
        databasePublicIds.add(publicId);
      }
    });
    
    console.log(`✅ Extracted ${databasePublicIds.size} public_ids from database\n`);

    // Step 2: Get all images from Cloudinary
    const cloudinaryImages = await getAllCloudinaryImages(folder);

    // Step 3: Find unused images
    const unusedImages = [];
    cloudinaryImages.forEach((resource, publicId) => {
      if (!databasePublicIds.has(publicId)) {
        unusedImages.push({
          public_id: publicId,
          url: resource.secure_url,
          created_at: resource.created_at,
          bytes: resource.bytes,
        });
      }
    });

    console.log('\n========================================');
    console.log(`📊 Results:`);
    console.log(`   Database images: ${databaseImages.size}`);
    console.log(`   Cloudinary images: ${cloudinaryImages.size}`);
    console.log(`   Unused images: ${unusedImages.length}`);
    console.log('========================================\n');

    if (unusedImages.length === 0) {
      console.log('✅ No unused images found. Everything is clean!');
      return { deleted: 0, unusedImages: [] };
    }

    // Display unused images
    console.log('🗑️  Unused images found:\n');
    unusedImages.forEach((img, index) => {
      const sizeKB = (img.bytes / 1024).toFixed(2);
      console.log(`${index + 1}. ${img.public_id}`);
      console.log(`   URL: ${img.url}`);
      console.log(`   Size: ${sizeKB} KB`);
      console.log(`   Created: ${img.created_at}\n`);
    });

    // Step 4: Delete unused images (if not dry run)
    if (!dryRun) {
      console.log('🔥 Starting deletion...\n');
      let deletedCount = 0;
      let failedCount = 0;

      for (const img of unusedImages) {
        try {
          const result = await cloudinary.uploader.destroy(img.public_id);
          if (result.result === 'ok') {
            deletedCount++;
            console.log(`✅ Deleted: ${img.public_id}`);
          } else {
            failedCount++;
            console.log(`❌ Failed to delete: ${img.public_id} (${result.result})`);
          }
        } catch (error) {
          failedCount++;
          console.error(`❌ Error deleting ${img.public_id}:`, error.message);
        }
      }

      console.log('\n========================================');
      console.log('🎯 Cleanup Complete!');
      console.log(`   Successfully deleted: ${deletedCount}`);
      console.log(`   Failed: ${failedCount}`);
      console.log('========================================\n');

      return { deleted: deletedCount, failed: failedCount, unusedImages };
    } else {
      console.log('ℹ️  DRY RUN MODE - No images were deleted.');
      console.log('   Run with dryRun=false to actually delete these images.\n');
      
      return { deleted: 0, unusedImages };
    }
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Load environment variables
  const dotenvPath = new URL('../.env', import.meta.url);
  const dotenv = await import('dotenv');
  dotenv.config({ path: dotenvPath.pathname });

  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const folder = args.find(arg => arg.startsWith('--folder='))?.split('=')[1] || 'ev';

  try {
    await cleanupUnusedImages({ dryRun, folder });
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

export default cleanupUnusedImages;
