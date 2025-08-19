import mongoose, { Schema, Document } from 'mongoose';

export interface ISchool extends Document {
  name: string;
  code: string;
  address?: string;
  contact?: string;
  enabled: boolean;
}

const SchoolSchema = new Schema<ISchool>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    address: { type: String },
    contact: { type: String },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SchoolModel = mongoose.model<ISchool>('School', SchoolSchema); 