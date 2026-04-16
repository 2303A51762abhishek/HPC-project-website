import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

// Critical: JWT_SECRET must be set in production
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('CRITICAL: JWT_SECRET environment variable is not set. Authentication will fail in production.');
}

const FALLBACK_SECRET = 'change_this_secret_in_production'; // Only for dev

export const verifyToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: 'No token provided' });
    const token = header.replace('Bearer ', '');
    const secret = JWT_SECRET || FALLBACK_SECRET;
    const payload = jwt.verify(token, secret);
    const user = await User.findById(payload.id).lean();
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token', error: err.message });
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (req.user.role !== role) return res.status(403).json({ message: 'Forbidden' });
  next();
};
