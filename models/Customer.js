import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  vehicleName: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  purchaseDate: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Indexes
customerSchema.index({ phone: 1 });
customerSchema.index({ city: 1 });
customerSchema.index({ purchaseDate: 1 });

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
