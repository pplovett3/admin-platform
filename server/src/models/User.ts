import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRole = 'superadmin' | 'schoolAdmin' | 'teacher' | 'student';

// 答题答案记录
export interface IQuizAnswer {
  questionId: string;
  userAnswer: string;
  correct: boolean;
}

// 答题记录
export interface IQuizRecord {
  courseId: string;           // AI课程ID
  publishId?: string;         // 发布ID（公开课程）
  score: number;              // 得分（百分制）
  totalQuestions: number;     // 题目总数
  correctCount: number;       // 正确数量
  answers: IQuizAnswer[];     // 答题详情
  completedAt: Date;          // 完成时间
}

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
  quizRecords?: IQuizRecord[]; // 答题记录
}

// 答题答案Schema
const QuizAnswerSchema = new Schema({
  questionId: { type: String, required: true },
  userAnswer: { type: String, required: true },
  correct: { type: Boolean, required: true }
}, { _id: false });

// 答题记录Schema
const QuizRecordSchema = new Schema({
  courseId: { type: String, required: true },
  publishId: { type: String },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  correctCount: { type: Number, required: true },
  answers: { type: [QuizAnswerSchema], default: [] },
  completedAt: { type: Date, default: Date.now }
}, { _id: false });

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
    quizRecords: { type: [QuizRecordSchema], default: [] },
  },
  { timestamps: true }
);

UserSchema.index({ className: 1, school: 1 });
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });

export const UserModel = mongoose.model<IUser>('User', UserSchema); 