import axios, { AxiosError } from 'axios';
import { LoginResponse, UserCourseActivation, VerifyResponse } from '../../shared/types';

// API基础地址
const API_BASE = process.env.API_BASE || 'http://localhost:4000';

// 获取存储的token
function getToken(): string | null {
  return localStorage.getItem('token');
}

// 设置token
export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

// 清除token
export function clearToken(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// 获取认证头
function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// 错误处理
function handleError(error: any): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    if (axiosError.response) {
      // 服务器返回错误
      throw new Error(axiosError.response.data?.message || `请求失败 (${axiosError.response.status})`);
    } else if (axiosError.request) {
      // 网络错误
      throw new Error('网络连接失败，请检查网络设置');
    }
  }
  throw new Error(error.message || '未知错误');
}

// POST请求
export async function apiPost<T>(path: string, body: any): Promise<T> {
  try {
    const response = await axios.post(`${API_BASE}${path}`, body, {
      headers: getAuthHeaders()
    });
    return response.data as T;
  } catch (error) {
    handleError(error);
  }
}

// GET请求
export async function apiGet<T>(path: string, params?: any): Promise<T> {
  try {
    const response = await axios.get(`${API_BASE}${path}`, {
      headers: getAuthHeaders(),
      params
    });
    return response.data as T;
  } catch (error) {
    handleError(error);
  }
}

// 用户登录
export async function login(phone: string, password: string): Promise<LoginResponse> {
  const response = await apiPost<LoginResponse>('/api/auth/login', { phone, password });
  
  // 保存token和用户信息
  setToken(response.token);
  localStorage.setItem('user', JSON.stringify(response.user));
  
  return response;
}

// 获取所有课程
export async function getAllCourses(): Promise<any[]> {
  return await apiGet<any[]>('/api/courses');
}

// 获取用户激活的课程列表
export async function getUserActivations(): Promise<UserCourseActivation[]> {
  const response = await apiGet<any>('/api/activation/my-activations');
  return response.activations || [];
}

// 激活课程
export async function activateCourse(code: string, courseId: string): Promise<any> {
  return await apiPost<any>('/api/activation/activate', { code, courseId });
}

// 验证课程访问权限
export async function verifyCourseAccess(courseId: string): Promise<VerifyResponse> {
  return await apiGet<VerifyResponse>('/api/activation/verify', { courseId });
}

// 获取当前用户信息
export function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// 检查是否已登录
export function isLoggedIn(): boolean {
  return !!getToken();
}

