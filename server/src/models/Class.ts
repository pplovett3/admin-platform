import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IClass extends Document {
  name: string; // 班级名称
  headTeacher?: Types.ObjectId; // 班主任用户ID（teacher）
  schoolId?: Types.ObjectId; // 归属学校
}

const ClassSchema = new Schema<IClass>(
  {
    name: { type: String, required: true, index: true },
    headTeacher: { type: Schema.Types.ObjectId, ref: 'User' },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', index: true },
  },
  { timestamps: true }
);

export const ClassModel = mongoose.model<IClass>('Class', ClassSchema); 