import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserCourseActivation extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  activationCode: string;
  activatedAt: Date;
  expiresAt?: Date;
  lastVerifiedAt?: Date;
  status: 'active' | 'expired' | 'revoked';
  createdAt: Date;
  updatedAt: Date;
}

const UserCourseActivationSchema = new Schema<IUserCourseActivation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    activationCode: { type: String, required: true },
    activatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    lastVerifiedAt: { type: Date },
    status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active', index: true }
  },
  { timestamps: true }
);

// 复合唯一索引：一个用户只能激活一次同一课程
UserCourseActivationSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const UserCourseActivationModel = mongoose.model<IUserCourseActivation>(
  'UserCourseActivation',
  UserCourseActivationSchema
);

