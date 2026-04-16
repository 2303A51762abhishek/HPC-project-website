import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: false  // Not required for general campaign banners
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  discount: {
    type: Number,
    required: false,  // Not required for general campaign banners
    min: 0,
    max: 100
  },
  sellingPrice: {
    type: Number,
    required: false,  // Optional field for offer selling price
    min: 0
  },
  validUntil: {
    type: Date
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed_amount', 'buy_one_get_one'],
    default: 'percentage'
  },
  // Banner configuration
  bannerType: {
    type: String,
    enum: ['general', 'vehicle'],
    default: 'vehicle'
  },
  bannerImageUrl: {
    type: String,
    trim: true
  },
  bannerBackground: {
    type: String,
    trim: true
  },
  conditions: {
    minQuantity: {
      type: Number,
      default: 1,
      min: 1
    },
    maxUsage: Number,
    applicableColors: [String]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
offerSchema.index({ vehicleId: 1 });
offerSchema.index({ isActive: 1 });
// TTL index: automatically delete documents when validUntil passes
// Note: MongoDB TTL monitor runs approximately once a minute.
offerSchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 });
offerSchema.index({ validFrom: 1 });

const Offer = mongoose.model('Offer', offerSchema);

export default Offer;
