import mongoose, { Schema, Document, Types } from 'mongoose';

// 资源虚拟文件夹（仅用于个人资源的逻辑分组，不影响物理存储路径）
export interface IFolder extends Document {
  name: string;
  ownerUserId: Types.ObjectId;
  parentId?: Types.ObjectId | null; // 父文件夹（null = 根目录）
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema = new Schema<IFolder>(
  {
    name: { type: String, required: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
  },
  { timestamps: true }
);

FolderSchema.index({ ownerUserId: 1, parentId: 1 });

export const FolderModel = mongoose.model<IFolder>('Folder', FolderSchema);
