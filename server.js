import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';

// Import routes
import vehicleRoutes from './routes/vehicles.js';
import offerRoutes from './routes/offers.js';
import customerRoutes from './routes/customers.js';
import authRoutes from './routes/auth.js';
import achievementRoutes from './routes/achievements.js';
import uploadRoutes from './routes/uploads.js';
import userRoutes from './routes/users.js';
import cleanupRoutes from './routes/cleanup.js';
import contactRoutes from './routes/contact.js';
import mongoose from 'mongoose';
import Offer from './models/Offer.js';
import './config/passport.js'; // Initialize passport config

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || process.env.port || 8080;

// Connect to MongoDB with optimized settings
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ev_vehicles';
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10, // Connection pool size
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 30000,
  family: 4 // Use IPv4, skip IPv6 to speed up connection
}).then(async () => {
  console.log('✅ Connected to MongoDB');
  try {
    // Ensure TTL index for offers (deletes expired offers automatically)
    await Offer.syncIndexes();
    // One-off cleanup in case TTL index wasn't present previously
    const now = new Date();
    const res = await Offer.deleteMany({ validUntil: { $lte: now } });
    if (res?.deletedCount) {
      console.log(`🧹 Cleaned up ${res.deletedCount} expired offers`);
    }
  } catch (e) {
    console.warn('⚠️  Offer index sync/cleanup skipped:', e.message);
  }
}).catch(err => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
});

// Security middleware
app.use(helmet());
// Enable gzip/deflate compression for API responses
app.use(compression());
// CORS configuration
// In development allow any origin (so mobile/dev-hosted frontends can call the API).
// In production, allow configured origins and safe wildcards (e.g., *.vercel.app).
// Add environment-based origins
const getOriginsList = () => {
  const baseOrigins = [
    'https://ev-website-rouge.vercel.app',
    'https://ev-website-wd95.onrender.com',
    'https://ts-backend-api-ebhsevfyf8dceqhq.southindia-01.azurewebsites.net',
    process.env.FRONTEND_URL,
  ];
  
  // Add localhost origins only in development
  if (process.env.NODE_ENV !== 'production') {
    baseOrigins.push('http://localhost:5173', 'http://localhost:8080', 'http://localhost:3000');
  }
  
  // Normalize all origins by removing trailing slashes
  return baseOrigins.filter(Boolean).map(origin => origin.replace(/\/$/, ''));
};
const staticAllowedOrigins = getOriginsList();

const isAllowedOrigin = (origin) => {
  try {
    if (!origin) return true; // server-to-server, curl, etc.
    // Normalize by removing trailing slash
    const normalizedOrigin = origin.replace(/\/$/, '');
    // Exact match
    if (staticAllowedOrigins.includes(normalizedOrigin)) return true;
    // Allow any Vercel preview/production subdomain
    const hostname = new URL(origin).hostname;
    if (/\.vercel\.app$/.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
};

const corsOptions = process.env.NODE_ENV === 'development'
  ? { origin: true, credentials: true }
  : {
      origin: function (origin, callback) {
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };

app.use(cors(corsOptions));
// Handle preflight for all routes
app.options('*', cors(corsOptions));

if (process.env.NODE_ENV === 'development') {
  console.log('⚙️  CORS: development mode - allowing requests from any origin');
} else {
  console.log('⚙️  CORS: production mode');
  console.log('   - Explicit origins:', staticAllowedOrigins);
  console.log('   - Wildcard allowed: *.vercel.app');
}

// Rate limiting - enable appropriate limits based on environment
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 5000, // Strict limit in production, relaxed in dev
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
// Body parsing middleware (tuneable via env if needed)
const bodyLimit = process.env.BODY_LIMIT_MB ? `${process.env.BODY_LIMIT_MB}mb` : '10mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// Initialize Passport
app.use(passport.initialize());

console.log('🔧 Using MongoDB storage');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/contact', contactRoutes);

// Health check endpoint (enhanced for monitoring)
app.get('/api/health', (req, res) => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  // Log health checks in production for debugging
  if (process.env.NODE_ENV === 'production') {
    console.log('[Health] Check received');
  }
  
  res.json(healthStatus);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💾 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}`);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Render-specific optimizations
  if (process.env.RENDER) {
    console.log('🎯 Running on Render - Keep-alive optimizations enabled');
  }
});
