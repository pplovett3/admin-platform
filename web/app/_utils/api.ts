export const API_BASE = ((): string => {
  const env = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  const isLocalHostEnv = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(env);
  if (env && !isLocalHostEnv) return env; // explicit non-local override
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const host = hostname || 'localhost';
    return `${protocol}//${host}:4000`;
  }
  // SSR fallback during build
  return env || 'http://localhost:4000';
})();

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
  let res: Response;
  try { res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() }); }
  catch (e: any) { throw new Error(e?.message || `GET ${path} 网络异常`); }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `GET ${path} failed (${res.status})`);
  return data as T;
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  let res: Response;
  try { res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }); }
  catch (e: any) { throw new Error(e?.message || `POST ${path} 网络异常`); }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `POST ${path} failed (${res.status})`);
  return data as T;
}

export async function apiPut<T>(path: string, body: any): Promise<T> {
  let res: Response;
  try { res = await fetch(`${API_BASE}${path}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }); }
  catch (e: any) { throw new Error(e?.message || `PUT ${path} 网络异常`); }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `PUT ${path} failed (${res.status})`);
  return data as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  let res: Response;
  try { res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: authHeaders() }); }
  catch (e: any) { throw new Error(e?.message || `DELETE ${path} 网络异常`); }
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.message || `DELETE ${path} failed (${res.status})`);
  return data as T;
} 