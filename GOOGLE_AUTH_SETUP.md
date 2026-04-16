# Google OAuth Login Setup Guide

## Overview
Google OAuth login has been added to your EV Website. Users can now sign in using their Google account.

## Setup Steps

### 1. Install Server Dependencies
```bash
cd server
npm install passport passport-google-oauth20
```

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - User Type: External
   - App name: EV Showroom
   - User support email: your-email@example.com
   - Developer contact: your-email@example.com
6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: EV Website
   - Authorized JavaScript origins:
     - `http://localhost:8080` (frontend)
     - `http://localhost:5001` (backend)
     - Add your production URLs when deploying
   - Authorized redirect URIs:
     - `http://localhost:5001/api/auth/google/callback` (backend only)
     - Add production callback URL when deploying (e.g., `https://api.your-domain.com/api/auth/google/callback`)
7. Copy the **Client ID** and **Client Secret**

### 3. Configure Environment Variables

Edit `server/.env` and add:

```env
GOOGLE_CLIENT_ID="your-google-client-id-from-step-2"
GOOGLE_CLIENT_SECRET="your-google-client-secret-from-step-2"
GOOGLE_CALLBACK_URL="http://localhost:5001/api/auth/google/callback"
FRONTEND_URL="http://localhost:8080"
```

For production, update the URLs:
```env
GOOGLE_CALLBACK_URL="https://your-api-domain.com/api/auth/google/callback"
FRONTEND_URL="https://your-domain.com"
```

### 4. Restart Server

```bash
cd server
npm run dev
```

## How It Works

### User Flow:
1. User clicks "Continue with Google" button on login page
2. User is redirected to Google's OAuth consent screen
3. After authorization, Google redirects back to `/api/auth/google/callback`
4. Backend generates JWT token and redirects to `/auth/google/callback?token=<jwt>`
5. Frontend receives token, stores it, and navigates to dashboard

### Database:
- Users authenticated via Google are stored with `googleId` field
- If a user already has an account with the same email, the Google account is linked
- No password is required for Google OAuth users

## Files Modified

### Backend:
- `server/config/passport.js` - Passport Google OAuth strategy
- `server/routes/auth.js` - Google OAuth routes (`/google`, `/google/callback`)
- `server/models/User.js` - Added `googleId` field, password optional for OAuth users
- `server/server.js` - Initialize passport
- `server/package.json` - Added passport dependencies

### Frontend:
- `src/pages/Auth/Login.tsx` - Added "Continue with Google" button
- `src/pages/Auth/GoogleCallback.tsx` - Handle OAuth callback
- `src/contexts/AuthContext.tsx` - Added `loginWithGoogle()` method
- `src/App.tsx` - Added `/auth/google/callback` route

## Testing

1. Start backend: `cd server && npm run dev`
2. Start frontend: `cd .. && npm run dev`
3. Navigate to http://localhost:8080/login
4. Click "Continue with Google"
5. Select Google account
6. Should redirect to dashboard

## Troubleshooting

### "redirect_uri_mismatch" error:
- Verify the callback URL in Google Console matches exactly: `http://localhost:5001/api/auth/google/callback`
- Check that both JavaScript origins are added: `http://localhost:8080` and `http://localhost:5001`
- For production, add your production callback URL

### Users not being created:
- Check MongoDB connection
- Verify Google API is enabled in Cloud Console
- Check server logs for errors

### Token not being received:
- Verify `FRONTEND_URL` in `.env` matches your frontend URL
- Check browser console for errors
- Verify callback route is correctly set up in App.tsx

## Security Notes

- Keep `GOOGLE_CLIENT_SECRET` confidential
- Use HTTPS in production
- Consider adding rate limiting to OAuth endpoints
- Regularly rotate secrets

## Production Checklist

- [ ] Add production URLs to Google OAuth consent screen
- [ ] Update `GOOGLE_CALLBACK_URL` in production `.env`
- [ ] Update `FRONTEND_URL` in production `.env`
- [ ] Enable HTTPS
- [ ] Test OAuth flow in production
- [ ] Monitor for failed authentication attempts
