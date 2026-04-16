import mongoose from 'mongoose';

const contactQuerySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  inquiryType: {
    type: String,
    enum: ['general', 'sales', 'support', 'feedback', 'test-drive'],
    default: 'general'
  },
  status: {
    type: String,
    enum: ['new', 'read', 'responded', 'closed'],
    default: 'new'
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for faster queries
contactQuerySchema.index({ createdAt: -1 });
contactQuerySchema.index({ status: 1 });
contactQuerySchema.index({ email: 1 });

const ContactQuery = mongoose.model('ContactQuery', contactQuerySchema);

export default ContactQuery;
