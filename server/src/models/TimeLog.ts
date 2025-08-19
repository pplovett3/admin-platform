import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITimeLog extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  startedAt: Date;
  endedAt: Date;
  durationSec: number;
}

const TimeLogSchema = new Schema<ITimeLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    durationSec: { type: Number, required: true },
  },
  { timestamps: true }
);

TimeLogSchema.index({ userId: 1, courseId: 1, startedAt: 1 });

export const TimeLogModel = mongoose.model<ITimeLog>('TimeLog', TimeLogSchema); 