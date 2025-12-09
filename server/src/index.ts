import express from 'express';
import cors from 'cors';
import { connectToDatabase } from './config/db';
import { config } from './config/env';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import scoreRoutes from './routes/scores.routes';
import { UserModel } from './models/User';
import { hashPassword } from './utils/password';
import schoolRoutes from './routes/schools.routes';
import courseRoutes from './routes/courses.routes';
import enrollmentRoutes from './routes/enrollments.routes';
import timeLogRoutes from './routes/timelog.routes';
import classRoutes from './routes/classes.routes';
import analyticsRoutes from './routes/analytics.routes';
import filesRoutes from './routes/files.routes';
import coursewaresRoutes from './routes/coursewares.routes';
import aiCoursesRoutes from './routes/ai-courses.routes';
import aiRoutes from './routes/ai.routes';
import publishRoutes from './routes/publish.routes';
import activationCodesRoutes from './routes/activation-codes.routes';
import activationRoutes from './routes/activation.routes';
import quizRoutes from './routes/quiz.routes';

async function migrateLegacyRoles(): Promise<void> {
  await UserModel.updateMany({ role: 'admin' as any }, { $set: { role: 'superadmin' } }).catch(() => undefined);
}

async function migrateAdminPhone(): Promise<void> {
  await UserModel.updateOne(
    { $or: [{ phone: { $exists: false } }, { phone: null }, { phone: '' }], name: 'Admin' },
    { $set: { phone: '13800000000' } }
  ).catch(() => undefined);
}

async function dropEmailIndexIfExists(): Promise<void> {
  try {
    const indexes = await (UserModel as any).collection.indexes();
    const emailIndex = indexes.find((i: any) => i.key && i.key.email);
    if (emailIndex) {
      const idxName: string = typeof emailIndex.name === 'string' ? emailIndex.name : 'email_1';
      await (UserModel as any).collection.dropIndex(idxName).catch(() => undefined);
      console.log('Dropped email index');
    }
  } catch {
    // ignore
  }
}

async function ensureDefaultAdmin(): Promise<void> {
  try {
    const existing = await UserModel.findOne({ name: 'Admin', role: 'superadmin' }).lean();
    if (existing) {
      await migrateAdminPhone();
      return;
    }
    const passwordHash = await hashPassword('admin123');
    await UserModel.create({
      name: 'Admin',
      phone: '13800000000',
      school: 'Default',
      className: 'Admin',
      role: 'superadmin',
      passwordHash,
    });
    console.log('Seeded default superadmin: Admin / admin123 (phone: 13800000000)');
  } catch (err: any) {
    if (err && (err.code === 11000 || err.code === 'E11000')) {
      console.log('Default superadmin already exists');
      return;
    }
    throw err;
  }
}

async function bootstrap() {
  await connectToDatabase();
  await dropEmailIndexIfExists();
  await migrateLegacyRoles();
  await migrateAdminPhone();
  if (process.env.SEED_DEFAULT_ADMIN !== 'false') {
    await ensureDefaultAdmin();
  } else {
    console.log('Skip default admin seeding due to SEED_DEFAULT_ADMIN=false');
  }

  const app = express();
  const corsOptions: cors.CorsOptions = {
    origin: [
      'http://106.15.229.165:3000',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://192.168.0.239:3000',
      'http://192.168.0.239:3001',
      'https://platform.yf-xr.com',  // Cloudflare Tunnel 前端域名
      'http://platformnew.yf-xr.com',  // Cloudflare Tunnel 前端域名（HTTP）
      'https://platformnew.yf-xr.com',  // Cloudflare Tunnel 前端域名（HTTPS）
      'https://api.platform.yf-xr.com'  // Cloudflare Tunnel 后端域名
    ],
    credentials: true,
    methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
    allowedHeaders: ['Authorization','Content-Type','Accept'],
    maxAge: 86400
  };
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  // 处理预检请求：显式允许所有路径的 OPTIONS（Express 5 推荐使用正则通配）
  app.options(/.*/, cors(corsOptions));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/scores', scoreRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/enrollments', enrollmentRoutes);
  app.use('/api/timelog', timeLogRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/analytics', analyticsRoutes);
	app.use('/api/files', filesRoutes);
  app.use('/api/coursewares', coursewaresRoutes);
  app.use('/api/ai-courses', aiCoursesRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api', publishRoutes);
  app.use('/api/activation-codes', activationCodesRoutes);
  app.use('/api/activation', activationRoutes);
  app.use('/api/quiz', quizRoutes);

  app.listen(config.port, () => {
    console.log('Server listening on port ' + config.port);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap server', err);
  process.exit(1);
});
