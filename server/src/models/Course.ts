import mongoose, { Schema, Document, Types } from 'mongoose';

export type CourseType = 'simple' | 'modular';

export interface ICourse extends Document {
  name: string;
  code: string;
  type: CourseType;
  description?: string;
  enabled: boolean;
}

const CourseSchema = new Schema<ICourse>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['simple', 'modular'], required: true },
    description: { type: String },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CourseModel = mongoose.model<ICourse>('Course', CourseSchema);

export interface ICourseModule extends Document {
  courseId: Types.ObjectId;
  moduleId: string; // unique within course
  name: string;
  maxScore: number;
  order: number;
}

const CourseModuleSchema = new Schema<ICourseModule>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    moduleId: { type: String, required: true },
    name: { type: String, required: true },
    maxScore: { type: Number, default: 100 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CourseModuleSchema.index({ courseId: 1, moduleId: 1 }, { unique: true });

export const CourseModuleModel = mongoose.model<ICourseModule>('CourseModule', CourseModuleSchema); 