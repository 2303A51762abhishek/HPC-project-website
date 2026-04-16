import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

// Configure Google OAuth if credentials are available
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('Google OAuth profile received:', {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName
          });

          // Check if user already exists with this Google ID
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            console.log('Found existing user with Google ID:', user._id);
            return done(null, user);
          }

          // Check if user exists with this email
          user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Link Google account to existing user
          console.log('Linking Google account to existing user:', user._id);
          user.googleId = profile.id;
          await user.save();
          return done(null, user);
        }

        // Create new user
        console.log('Creating new user from Google profile');
        user = await User.create({
          googleId: profile.id,
          username: profile.displayName,
          email: profile.emails[0].value,
          role: 'user',
          // No password needed for Google OAuth users
        });

        console.log('New user created:', user._id);
        done(null, user);
      } catch (error) {
        console.error('Error in Google OAuth strategy:', error);
        done(error, null);
      }
    }
  )
);
} else {
  console.warn('⚠️  Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set');
}

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
