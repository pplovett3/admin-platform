import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IActivationCode extends Document {
  code: string;
  courseId: Types.ObjectId;
  maxUses: number;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
  status: 'active' | 'disabled';
  description?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ActivationCodeSchema = new Schema<IActivationCode>(
  {
    code: { type: String, required: true, unique: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    maxUses: { type: Number, required: true, default: 30 },
    usedCount: { type: Number, default: 0 },
    validFrom: { type: Date, required: true, default: Date.now },
    validUntil: { type: Date, required: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
    description: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const ActivationCodeModel = mongoose.model<IActivationCode>('ActivationCode', ActivationCodeSchema);

