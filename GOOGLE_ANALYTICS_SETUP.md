# Google Analytics Setup Guide

This guide will help you integrate Google Analytics 4 (GA4) data into your Admin Dashboard.

## Prerequisites

- Access to your Google Analytics 4 account for cleanboxsnacks.com
- Admin access to Google Cloud Console

## Step 1: Get Your GA4 Property ID

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your property for cleanboxsnacks.com
3. Click on **Admin** (gear icon in bottom left)
4. Under **Property** column, click on **Property Settings**
5. Find your **Property ID** (format: `123456789`)
6. Copy this ID - you'll need it for your `.env` file

## Step 2: Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project for your analytics integration
3. Navigate to **IAM & Admin** > **Service Accounts**
4. Click **Create Service Account**
5. Enter details:
   - **Service account name**: `admin-dashboard-analytics`
   - **Service account ID**: Will auto-populate
   - **Description**: `Service account for admin dashboard GA4 access`
6. Click **Create and Continue**
7. Skip granting additional roles (click **Continue**)
8. Click **Done**

## Step 3: Create and Download Service Account Key

1. In the Service Accounts list, click on the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Select **JSON** format
5. Click **Create**
6. A JSON file will download - **save this file securely**
7. Rename the file to something simple like `ga-service-account.json`

## Step 4: Grant Analytics Access to Service Account

1. Go back to [Google Analytics](https://analytics.google.com/)
2. Click on **Admin** (gear icon)
3. Under **Account** column, click **Account Access Management**
4. Click the **+** button in the top right
5. Click **Add users**
6. Enter the service account email (found in the JSON file or Cloud Console)
   - Format: `admin-dashboard-analytics@your-project.iam.gserviceaccount.com`
7. Select role: **Viewer**
8. Uncheck "Notify new users by email"
9. Click **Add**

## Step 5: Place Service Account Key File

1. Copy the `ga-service-account.json` file to your backend directory:

   ```
   /Users/jwax/ADMIN-CLEANBOX/backend/ga-service-account.json
   ```

2. **IMPORTANT**: Make sure this file is listed in your `.gitignore` (it should be):
   ```
   # In backend/.gitignore
   ga-service-account.json
   *.json
   ```

## Step 6: Update Backend Environment Variables

1. Open or create `/Users/jwax/ADMIN-CLEANBOX/backend/.env`
2. Add the following lines:

```bash
# Google Analytics Configuration
GA_PROPERTY_ID=your-property-id-here
GA_KEY_FILE_PATH=ga-service-account.json
```

Replace `your-property-id-here` with your actual GA4 Property ID from Step 1.

## Step 7: Verify Setup

1. Restart your backend server:

   ```bash
   cd /Users/jwax/ADMIN-CLEANBOX/backend
   node server.js
   ```

2. Look for this message in the console:

   ```
   ✅ Google Analytics API initialized successfully
   ```

3. If you see warnings like:

   ```
   ⚠️  GA_PROPERTY_ID not set in environment variables
   ```

   Double-check your `.env` file and restart the server.

4. Open your admin dashboard at `http://localhost:5173`
5. Navigate to the **KPI** page
6. You should now see your Google Analytics data!

## Troubleshooting

### "Analytics client not initialized"

- Verify your `.env` file has both `GA_PROPERTY_ID` and `GA_KEY_FILE_PATH`
- Ensure the service account JSON file exists at the specified path
- Restart the backend server

### "Permission denied" or "403 Forbidden"

- Verify the service account email has been granted access in Google Analytics
- Make sure you granted at least "Viewer" role
- Wait a few minutes for permissions to propagate

### "Invalid credentials"

- Re-download the service account key JSON file
- Verify the JSON file is valid (open it in a text editor)
- Make sure the file path in `.env` is correct

### No data showing

- Verify your website has active Google Analytics tracking
- Check that your GA4 property ID is correct
- Try changing the date range in the dashboard

## API Endpoints

The following endpoints are now available:

- `GET /api/analytics/overview` - Overview metrics (users, sessions, pageviews, etc.)
- `GET /api/analytics/top-pages` - Most viewed pages
- `GET /api/analytics/traffic-sources` - Traffic source breakdown
- `GET /api/analytics/daily-trend` - Daily user/session trends

All endpoints support query parameters:

- `startDate` (default: "30daysAgo")
- `endDate` (default: "today")
- `limit` (for top-pages, default: 10)

## Security Notes

⚠️ **IMPORTANT**:

- Never commit your service account JSON file to version control
- Never share your service account key publicly
- The service account has read-only access to your analytics data
- Consider using environment-specific service accounts for production

## Handling the JSON File in Different Scenarios

### GitHub Won't Accept It (Push Protection)

GitHub blocks sensitive files like service account keys. This is **expected and good**! Here's how to handle it:

**✅ Current Setup (Recommended for Local Development)**
- File is on your local machine: `backend/ga-service-account.json`
- File is in `.gitignore` - won't be pushed to GitHub
- Your app works locally with the file

**For Team Members Who Clone the Repo:**
1. They need to create their own service account (follow Steps 2-4)
2. Download their own JSON file
3. Place it at `backend/ga-service-account.json`
4. Add it to their local `.env` file

### For Production Deployment

**Option 1: Environment Variable (Recommended)**

Encode the JSON as a base64 string and use it as an environment variable:

```bash
# On your local machine, encode the file
base64 backend/ga-service-account.json

# Copy the output and add to your hosting platform as:
GA_SERVICE_ACCOUNT_BASE64=<paste the encoded string here>
```

Then update `backend/services/googleAnalytics.js` to support this:

```javascript
// Add this at the top of initializeAnalytics()
let credentials;
if (process.env.GA_SERVICE_ACCOUNT_BASE64) {
  // For production: use base64-encoded env variable
  credentials = JSON.parse(
    Buffer.from(process.env.GA_SERVICE_ACCOUNT_BASE64, 'base64').toString()
  );
} else {
  // For local dev: use JSON file
  credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
}
```

**Option 2: Platform Secret Storage**

Most hosting platforms have secure secret storage:
- **Vercel**: Environment Variables (paste file contents)
- **Heroku**: Config Vars
- **Railway**: Variables tab
- **AWS/GCP**: Secret Manager

**Option 3: Manual Upload to Server**

If deploying to your own VPS:
1. SSH into the server
2. Manually upload `ga-service-account.json` 
3. Set file permissions: `chmod 600 ga-service-account.json`
4. Keep it outside the git repository directory

### Summary

| Scenario | Solution |
|----------|----------|
| Local development | Keep file locally, in `.gitignore` ✅ |
| GitHub push | File is blocked (expected!) - don't push it |
| Team member clones | They create their own service account |
| Production deployment | Use environment variables or secret manager |

## Support

For more information, see:

- [Google Analytics Data API Documentation](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Service Account Authentication](https://cloud.google.com/docs/authentication/getting-started)

