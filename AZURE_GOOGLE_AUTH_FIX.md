# Fix Google OAuth on Azure App Service

## Problem
Error 400: redirect_uri_mismatch when signing in with Google on Azure deployment.

## Solution

### Step 1: Update Azure App Service Environment Variables

1. Go to your Azure Portal
2. Navigate to your App Service
3. Go to **Configuration** → **Application settings**
4. Add/Update these variables:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-backend.azurewebsites.net/api/auth/google/callback
FRONTEND_URL=https://your-frontend-domain.com
```

**Replace:**
- `your-backend.azurewebsites.net` with your actual Azure App Service URL
- `your-frontend-domain.com` with your actual frontend URL (Vercel/Netlify/etc.)

5. Click **Save** and **Restart** your App Service

### Step 2: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Under **Authorized redirect URIs**, add:
   ```
   https://your-backend.azurewebsites.net/api/auth/google/callback
   ```
6. Under **Authorized JavaScript origins**, add:
   ```
   https://your-backend.azurewebsites.net
   https://your-frontend-domain.com
   ```
7. Click **Save**

### Step 3: Test

1. Wait 5-10 minutes for changes to propagate
2. Try logging in with Google again
3. Should now redirect correctly

## Common Issues

### Issue: Still getting redirect_uri_mismatch
- **Check:** Make sure the URL in Google Console **exactly** matches your Azure backend URL
- **Check:** Ensure you've saved and restarted your Azure App Service
- **Check:** URLs must include `https://` and `/api/auth/google/callback` path
- **Wait:** Google changes can take up to 10 minutes to propagate

### Issue: Authentication works but redirects to wrong URL
- **Check:** `FRONTEND_URL` environment variable in Azure App Service
- **Check:** It should be your actual frontend domain (not localhost)

### Issue: CORS errors after fixing redirect
- **Check:** Your backend CORS configuration allows your frontend domain
- Update `server.js` if needed to include your frontend URL in CORS origins

## Verification Checklist

- [ ] Azure App Service has `GOOGLE_CALLBACK_URL` with correct backend URL
- [ ] Azure App Service has `FRONTEND_URL` with correct frontend URL
- [ ] Google Console has redirect URI matching Azure backend URL
- [ ] Google Console has JavaScript origins for both backend and frontend
- [ ] All URLs use `https://` (not `http://`)
- [ ] Azure App Service has been restarted after configuration changes
- [ ] Waited 5-10 minutes for Google changes to propagate

## Example Configuration

### Azure Environment Variables:
```
GOOGLE_CLIENT_ID=123456789-abc123.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
GOOGLE_CALLBACK_URL=https://ev-backend.azurewebsites.net/api/auth/google/callback
FRONTEND_URL=https://ev-showroom.vercel.app
```

### Google Cloud Console:
**Authorized redirect URIs:**
- `https://ev-backend.azurewebsites.net/api/auth/google/callback`

**Authorized JavaScript origins:**
- `https://ev-backend.azurewebsites.net`
- `https://ev-showroom.vercel.app`
