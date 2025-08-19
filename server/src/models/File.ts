import mongoose, { Schema, Document, Types } from 'mongoose';
import { UserRole } from './User';

export type FileVisibility = 'private' | 'public';
export type FileKind = 'video' | 'image' | 'pdf' | 'ppt' | 'word' | 'other';

export interface IFile extends Document {
	ownerUserId: Types.ObjectId;
	ownerRole: UserRole;
	visibility: FileVisibility;
	type: FileKind;
	originalName: string;
	ext: string;
	size: number;
	sha256: string;
	storageRelPath: string; // POSIX-like relative path under STORAGE_ROOT
	createdAt: Date;
	updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
	{
		ownerUserId: { type: Schema.Types.ObjectId, required: true, index: true },
		ownerRole: { type: String, enum: ['superadmin', 'schoolAdmin', 'teacher', 'student'], required: true },
		visibility: { type: String, enum: ['private', 'public'], required: true, index: true },
		type: { type: String, enum: ['video', 'image', 'pdf', 'ppt', 'word', 'other'], required: true },
		originalName: { type: String, required: true },
		ext: { type: String, required: true },
		size: { type: Number, required: true },
		sha256: { type: String, required: true, index: true },
		storageRelPath: { type: String, required: true },
	},
	{ timestamps: true }
);

FileSchema.index({ ownerUserId: 1, createdAt: -1 });

export const FileModel = mongoose.model<IFile>('File', FileSchema); 