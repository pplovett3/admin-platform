import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'superadmin' | 'schoolAdmin' | 'teacher' | 'student';

export interface IUser extends Document {
  name: string;
  school?: string; // legacy text field
  schoolId?: Types.ObjectId; // reference to School
  className: string;
  studentId?: string;
  phone?: string;
  role: UserRole;
  metaverseAllowed?: boolean;
  passwordHash: string;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    school: { type: String },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', index: true },
    className: { type: String, required: false, default: '' },
    studentId: { type: String },
    phone: { type: String },
    role: { type: String, enum: ['superadmin', 'schoolAdmin', 'teacher', 'student'], required: true },
    passwordHash: { type: String, required: true },
    metaverseAllowed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.index({ className: 1, school: 1 });
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });

export const UserModel = mongoose.model<IUser>('User', UserSchema); 