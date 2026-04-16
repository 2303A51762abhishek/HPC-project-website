# Cloudinary Image Cleanup Utility

This utility helps you identify and delete unused images from Cloudinary that are no longer referenced in your database.

## Features

- 🔍 Scans all images in database (vehicles, offers, achievements)
- 📊 Compares with images stored in Cloudinary
- 🗑️ Identifies unused images
- 🔥 Safely deletes unused images (with dry-run mode)
- 📝 Detailed logging and statistics

## Usage

### 1. Command Line (Local)

**Dry Run (Preview only - recommended first):**
```bash
npm run cleanup:dry
```

**Live Run (Actually deletes images):**
```bash
npm run cleanup:live
```

**Custom folder:**
```bash
node utils/cleanupUnusedImages.js --folder=ev --live
```

### 2. API Endpoints

#### Manual Cleanup (Admin only)
```bash
POST /api/cleanup/cleanup-images
Authorization: Bearer <admin-token>

Body:
{
  "dryRun": true,  // false to actually delete
  "folder": "ev"   // Cloudinary folder name
}
```

#### Get Cleanup Statistics (Admin only)
```bash
GET /api/cleanup/cleanup-stats
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "success": true,
  "stats": {
    "unusedCount": 15,
    "totalSize": 2458624,
    "images": [...]
  }
}
```

#### Scheduled Cleanup (For External Cron Jobs)
```bash
POST /api/cleanup/scheduled-cleanup
X-Cleanup-Secret: <your-secret-key>

# No body needed
```

This endpoint is designed for automated scheduling services like:
- Azure Logic Apps
- Azure Functions (Timer Trigger)
- AWS Lambda (Scheduled Events)
- GitHub Actions (Scheduled Workflows)

## Environment Variables

Add to your `.env` file:

```bash
# Required for cleanup
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=ev

# Required for scheduled cleanup endpoint
CLEANUP_SECRET_KEY=your-secret-key-for-scheduled-cleanup
```

## How It Works

1. **Scans Database**: Collects all image URLs from:
   - Vehicle images (main + color-specific)
   - Offer banners
   - Achievement images

2. **Scans Cloudinary**: Fetches all images from your Cloudinary folder

3. **Compares**: Identifies images in Cloudinary that aren't referenced in database

4. **Reports**: Shows detailed list of unused images with:
   - Public ID
   - URL
   - File size
   - Creation date

5. **Deletes** (if not dry run): Removes unused images from Cloudinary

## Example Output

```
========================================
🧹 Cloudinary Unused Images Cleanup
========================================
Mode: DRY RUN (no deletions)
Folder: ev
========================================

✅ Found 245 images in database
✅ Extracted 245 public_ids from database

📥 Fetching images from Cloudinary folder: ev...
   Fetched 287 images (total: 287)
✅ Found 287 images in Cloudinary

========================================
📊 Results:
   Database images: 245
   Cloudinary images: 287
   Unused images: 42
========================================

🗑️  Unused images found:

1. ev/vehicles/old-image-123
   URL: https://res.cloudinary.com/.../ev/vehicles/old-image-123.jpg
   Size: 245.67 KB
   Created: 2025-10-15T10:30:00Z

...
```

## Best Practices

1. **Always run dry-run first** to preview what will be deleted
2. **Review the list** of unused images before running live cleanup
3. **Schedule regular cleanups** (weekly or monthly) to prevent storage bloat
4. **Monitor logs** to ensure cleanup is working correctly
5. **Keep backups** of important images before running cleanup

## Scheduling Options

### Option 1: Azure Logic Apps
1. Create a Logic App with Recurrence trigger (weekly)
2. Add HTTP action to call `/api/cleanup/scheduled-cleanup`
3. Set header: `X-Cleanup-Secret: <your-secret>`

### Option 2: GitHub Actions
Create `.github/workflows/cleanup.yml`:
```yaml
name: Cleanup Unused Images
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2 AM

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cleanup
        run: |
          curl -X POST https://your-api.com/api/cleanup/scheduled-cleanup \
            -H "X-Cleanup-Secret: ${{ secrets.CLEANUP_SECRET }}"
```

### Option 3: Manual Admin Dashboard
Add a button in your admin dashboard that calls the cleanup endpoint with `dryRun: true` first, shows the preview, then allows admin to confirm and run with `dryRun: false`.

## Troubleshooting

**"Could not extract public_id from URL"**
- Check that your Cloudinary URLs follow the standard format
- Verify the `extractPublicId` function matches your URL pattern

**"Unauthorized" on scheduled cleanup**
- Ensure `CLEANUP_SECRET_KEY` is set in environment variables
- Verify the secret in request header matches

**Images still showing as unused after deletion**
- Wait a few minutes for Cloudinary CDN cache to clear
- Check if images are referenced in other collections not scanned

## Safety Features

- ✅ Dry run mode by default
- ✅ Detailed preview before deletion
- ✅ Admin authentication required for manual cleanup
- ✅ Secret key required for scheduled cleanup
- ✅ Comprehensive logging
- ✅ Error handling with rollback on failures
