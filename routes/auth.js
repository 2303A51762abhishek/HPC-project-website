import express from 'express';
import { body, validationResult } from 'express-validator';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import passport from '../config/passport.js';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Login
router.post('/login', [
  body('identifier').notEmpty().withMessage('Email or phone is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier, password } = req.body;
    
    // Normalize identifier
    const normalizedIdentifier = identifier.trim();
    
    // Check if identifier is email or phone
    const isEmail = /^\S+@\S+\.\S+$/.test(normalizedIdentifier);
    const query = isEmail ? { email: normalizedIdentifier.toLowerCase() } : { phone: normalizedIdentifier };
    
    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(403).json({ message: 'Account is temporarily locked. Please try again later' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Please contact support' });
    }

    // Check if user registered with Google OAuth (no password)
    if (user.googleId && !user.password) {
      return res.status(401).json({ message: 'This account uses Google login. Please sign in with Google' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });

    // Reset login attempts and update last login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    res.json({ token, user: { id: user._id, email: user.email, name: user.username, role: user.role } });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
});

// Register (with optional admin secret)
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('username').trim().isLength({ min: 2 }).withMessage('Username must be at least 2 characters'),
  body('phone').optional().trim().matches(/^[0-9]{10}$/).withMessage('Phone must be exactly 10 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, phone, adminSecret } = req.body;

    // Normalize data
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();
    const normalizedPhone = phone?.trim();

    // Check admin secret first (before checking existing user)
    let role = 'user';
    if (adminSecret) {
      if (process.env.ADMIN_SECRET_NAME && adminSecret.trim() === process.env.ADMIN_SECRET_NAME) {
        role = 'admin';
      } else {
        return res.status(400).json({ message: 'Wrong admin secret' });
      }
    }

    // Check for existing user with detailed feedback
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username: normalizedUsername },
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
      ]
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return res.status(400).json({ message: 'Email is already registered' });
      }
      if (existingUser.username === normalizedUsername) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      if (normalizedPhone && existingUser.phone === normalizedPhone) {
        return res.status(400).json({ message: 'Phone number is already registered' });
      }
      return res.status(400).json({ message: 'User already exists' });
    }

    const userData = {
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      role,
      isActive: true,
      loginAttempts: 0
    };
    
    if (normalizedPhone) userData.phone = normalizedPhone;
    
    const newUser = new User(userData);
    await newUser.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` });
    }
    
    res.status(500).json({ message: 'Error during registration', error: error.message });
  }
});

// Get profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id).lean();
    if (!user) return res.status(401).json({ message: 'Invalid token' });

    res.json({ id: user._id, email: user.email, name: user.username, role: user.role });
  } catch (error) {
    console.error('Error fetching profile:', error);
    
    // Return 401 for JWT errors (invalid signature, expired token, etc.)
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
});

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    try {
      // Check if authentication was successful
      if (!req.user) {
        const frontendURL = process.env.FRONTEND_URL || 'http://localhost:8080';
        return res.redirect(`${frontendURL}/login?error=auth_failed`);
      }

      // Generate JWT token for the user
      const token = jwt.sign({ id: req.user._id, role: req.user.role }, JWT_SECRET, { expiresIn: '12h' });
      
      // Update last login
      req.user.lastLogin = new Date();
      await req.user.save();

      // Redirect to frontend with token
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:8080';
      const redirectURL = `${frontendURL}/auth/google/callback?token=${token}`;
      res.redirect(redirectURL);
    } catch (error) {
      console.error('Error in Google callback:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/login?error=auth_failed`);
    }
  }
);

export default router;