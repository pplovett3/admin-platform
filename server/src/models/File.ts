import mongoose, { Schema, Document, Types } from 'mongoose';
import { UserRole } from './User';

export type FileVisibility = 'private' | 'public';
export type FileKind = 'video' | 'image' | 'pdf' | 'ppt' | 'word' | 'model' | 'other';

export interface IFile extends Document {
	ownerUserId: Types.ObjectId;
	ownerRole: UserRole;
	visibility: FileVisibility;
	type: FileKind;
	originalName: string; // display name (decoded)
	originalNameSaved: string; // real saved filename
	ext: string;
	size: number;
	sha256: string;
	storageRelPath: string; // POSIX-like relative path to saved file
	storageDir: string; // POSIX-like relative directory
	folderId?: Types.ObjectId | null; // 所属虚拟文件夹（null = 根目录）
	thumbnailRelPath?: string | null; // 封面/截图（主要用于模型），相对存储路径；附属文件，不计入配额
	createdAt: Date;
	updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
	{
		ownerUserId: { type: Schema.Types.ObjectId, required: true, index: true },
		ownerRole: { type: String, enum: ['superadmin', 'schoolAdmin', 'teacher', 'student'], required: true },
		visibility: { type: String, enum: ['private', 'public'], required: true, index: true },
		type: { type: String, enum: ['video', 'image', 'pdf', 'ppt', 'word', 'model', 'other'], required: true },
		originalName: { type: String, required: true },
		originalNameSaved: { type: String, required: true },
		ext: { type: String, required: true },
		size: { type: Number, required: true },
		sha256: { type: String, required: true, index: true },
		storageRelPath: { type: String, required: true },
		storageDir: { type: String, required: true },
		folderId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
		thumbnailRelPath: { type: String, default: null },
	},
	{ timestamps: true }
);

FileSchema.index({ ownerUserId: 1, createdAt: -1 });

export const FileModel = mongoose.model<IFile>('File', FileSchema); 