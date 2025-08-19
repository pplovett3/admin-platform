import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEnrollment extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  status: 'active' | 'archived';
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const EnrollmentModel = mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema);

export interface ISchoolCourse extends Document {
  schoolId: Types.ObjectId;
  courseId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  enabled: boolean;
}

const SchoolCourseSchema = new Schema<ISchoolCourse>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, default: Date.now },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SchoolCourseSchema.index({ schoolId: 1, courseId: 1 }, { unique: true });

export const SchoolCourseModel = mongoose.model<ISchoolCourse>('SchoolCourse', SchoolCourseSchema); 