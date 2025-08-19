import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISubmissionModuleScore {
  moduleId: string;
  score: number;
  maxScore: number;
  attempts: number;
  completedAt?: Date;
  moreDetail?: string;
}

export interface IScoreSubmission extends Document {
  user: Types.ObjectId;
  courseId: string; // store Course _id as string for consistency with ScoreModel
  moduleScores: ISubmissionModuleScore[];
  submittedAt: Date;
}

const SubmissionModuleScoreSchema = new Schema<ISubmissionModuleScore>(
  {
    moduleId: { type: String, required: true },
    score: { type: Number, required: true, default: 0 },
    maxScore: { type: Number, required: true, default: 100 },
    attempts: { type: Number, required: true, default: 1 },
    completedAt: { type: Date },
    moreDetail: { type: String },
  },
  { _id: false }
);

const ScoreSubmissionSchema = new Schema<IScoreSubmission>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: String, required: true, index: true },
    moduleScores: { type: [SubmissionModuleScoreSchema], default: [] },
    submittedAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true }
);

ScoreSubmissionSchema.index({ user: 1, courseId: 1, submittedAt: -1 });

export const ScoreSubmissionModel = mongoose.model<IScoreSubmission>('ScoreSubmission', ScoreSubmissionSchema); 