// 动态获取 API BASE URL：使用相对路径通过 Next.js rewrites 代理
// 注意：这个函数在每次调用时都会重新计算，确保使用最新的 hostname
export function getAPI_BASE(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // 优先检测公网域名，使用相对路径（通过 Next.js rewrites）
    if (hostname.includes('yf-xr.com') || hostname.includes('platform')) {
      console.log('[API_BASE] 检测到公网域名，使用相对路径:', hostname);
      return ''; // 使用相对路径，Next.js 会自动代理到后端
    }
    // 本地开发环境：localhost 或 127.0.0.1，使用 localhost:4000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log('[API_BASE] 检测到本地环境，使用 localhost:4000');
      return 'http://localhost:4000';
    }
    // 其他情况（内网IP等），使用当前域名
    console.log('[API_BASE] 使用当前域名:', window.location.origin);
    return window.location.origin;
  }
  // SSR fallback during build
  const env = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  return env || 'http://localhost:4000';
}

// 为了兼容性，保留原来的常量形式，但改为函数调用
export const API_BASE = getAPI_BASE();

export function authHeaders(extra?: Record<string, string>) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return { Authorization: `Bearer ${token || ''}`, 'Content-Type': 'application/json', ...(extra || {}) } as Record<string, string>;
}

async function parseJsonSafe(res: Response): Promise<any> {
  try {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { message: text }; }
  } catch { return null; }
}

export async function apiGet<T>(path: string): Promise<T> {
  // 每次调用时重新获取 API_BASE，确保使用最新的 hostname
  const apiBase = getAPI_BASE();
  const fullUrl = `${apiBase}${path}`;
  console.log('[apiGet] API BASE:', apiBase, 'Full URL:', fullUrl);
  let res: Response;
  try { res = await fetch(fullUrl, { headers: authHeaders() }); }
  catch (e: any) { throw new Error(e?.message || `GET ${path} 网络异常`); }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `GET ${path} failed (${res.status})`);
  return data as T;
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const apiBase = getAPI_BASE();
  const fullUrl = `${apiBase}${path}`;
  console.log('[apiPost] API BASE:', apiBase, 'Full URL:', fullUrl);
  let res: Response;
  try { res = await fetch(fullUrl, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }); }
  catch (e: any) { throw new Error(e?.message || `POST ${path} 网络异常`); }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `POST ${path} failed (${res.status})`);
  return data as T;
}

export async function apiPut<T>(path: string, body: any): Promise<T> {
  const apiBase = getAPI_BASE();
  const fullUrl = `${apiBase}${path}`;
  let res: Response;
  try { res = await fetch(fullUrl, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }); }
  catch (e: any) { throw new Error(e?.message || `PUT ${path} 网络异常`); }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `PUT ${path} failed (${res.status})`);
  return data as T;
}

export async function apiPatch<T>(path: string, body: any): Promise<T> {
  const apiBase = getAPI_BASE();
  const fullUrl = `${apiBase}${path}`;
  let res: Response;
  try { res = await fetch(fullUrl, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) }); }
  catch (e: any) { throw new Error(e?.message || `PATCH ${path} 网络异常`); }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `PATCH ${path} failed (${res.status})`);
  return data as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const apiBase = getAPI_BASE();
  const fullUrl = `${apiBase}${path}`;
  let res: Response;
  try { res = await fetch(fullUrl, { method: 'DELETE', headers: authHeaders() }); }
  catch (e: any) { throw new Error(e?.message || `DELETE ${path} 网络异常`); }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `DELETE ${path} failed (${res.status})`);
  return data as T;
} 