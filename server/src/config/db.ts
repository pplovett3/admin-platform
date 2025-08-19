import mongoose from 'mongoose';
import { config } from './env';

export async function connectToDatabase(): Promise<void> {
  await mongoose.connect(config.mongoUri, { autoIndex: true } as any);
} 