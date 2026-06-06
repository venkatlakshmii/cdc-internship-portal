import mongoose from 'mongoose';

const PortalControlSchema = new mongoose.Schema({
  newApplicationsEnabled: { type: Boolean, default: true },
  monthlyReportsEnabled: { type: Boolean, default: true },
  completionsEnabled: { type: Boolean, default: true },
  communicationsEnabled: { type: Boolean, default: true },
  notificationsEnabled: { type: Boolean, default: true },
  manualOverride: { type: String, enum: ['none', 'force_enable', 'force_disable'], default: 'none' },
  overrideReason: { type: String, default: '' },
  overrideExpiryDate: { type: Date }
}, { timestamps: true });

export const PortalControl = mongoose.model('PortalControl', PortalControlSchema);
