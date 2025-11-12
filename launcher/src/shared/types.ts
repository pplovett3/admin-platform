// 用户信息
export interface User {
  id: string;
  name: string;
  role: 'superadmin' | 'schoolAdmin' | 'teacher' | 'student';
  phone: string;
  className?: string;
  school?: string;
  schoolId?: string;
}

// 登录响应
export interface LoginResponse {
  token: string;
  user: User;
}

// 课程信息
export interface Course {
  _id: string;
  name: string;
  description?: string;
  coverImage?: string;
}

// 用户课程激活记录
export interface UserCourseActivation {
  _id: string;
  userId: string;
  courseId: Course;
  activationCode: string;
  activatedAt: string;
  expiresAt?: string;
  lastVerifiedAt?: string;
  status: 'active' | 'expired' | 'revoked';
}

// 课程配置（本地配置文件）
export interface CourseConfig {
  courseId: string;
  appPath: string;
  icon?: string;
  name?: string;
}

// 配置文件结构
export interface LauncherConfig {
  courses: CourseConfig[];
}

// 课程验证响应
export interface VerifyResponse {
  allowed: boolean;
  courseId?: string;
  expiresAt?: string;
  lastVerifiedAt?: string;
  reason?: string;
  message?: string;
}

// IPC消息类型
export interface IPCMessage {
  type: 'LAUNCH_APP' | 'GET_CONFIG' | 'VERIFY_ACTIVATION';
  payload?: any;
}

