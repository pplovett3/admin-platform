import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IModuleScore {
  moduleId: string;
  score: number;
  maxScore: number;
  attempts: number;
  completedAt?: Date;
  moreDetail?: string;
}

export interface IScore extends Document {
  user: Types.ObjectId;
  courseId: string;
  moduleScores: IModuleScore[];
}

const ModuleScoreSchema = new Schema<IModuleScore>(
  {
    moduleId: { type: String, required: true },
    score: { type: Number, required: true, default: 0 },
    maxScore: { type: Number, required: true, default: 100 },
    attempts: { type: Number, required: true, default: 0 },
    completedAt: { type: Date },
    moreDetail: { type: String },
  },
  { _id: false }
);

const ScoreSchema = new Schema<IScore>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: String, required: true, index: true },
    moduleScores: { type: [ModuleScoreSchema], default: [] },
  },
  { timestamps: true }
);

ScoreSchema.index({ user: 1, courseId: 1 }, { unique: true });

export const ScoreModel = mongoose.model<IScore>('Score', ScoreSchema); 