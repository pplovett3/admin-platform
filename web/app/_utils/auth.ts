export type Role = 'superadmin' | 'schoolAdmin' | 'teacher' | 'student';

export interface JwtPayload {
  userId: string;
  role: Role;
  className?: string;
  school?: string;
  schoolId?: string;
  name?: string;
  phone?: string;
  exp?: number;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function base64UrlDecodeUtf8(str: string): string {
  const pad = (s: string) => s + '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = pad(str.replace(/-/g, '+').replace(/_/g, '/'));
  try {
    const binary = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(bytes);
    }
    // Fallback for very old browsers
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return decodeURIComponent(escape(binary));
  } catch {
    return '';
  }
}

export function parseJwt(token: string | null): JwtPayload | null {
  try {
    if (!token) return null;
    const payloadSeg = token.split('.')[1] || '';
    const json = base64UrlDecodeUtf8(payloadSeg);
    const payload = JSON.parse(json) as JwtPayload;
    return payload || null;
  } catch {
    return null;
  }
}

export function hasRole(roles: Role[], current?: Role): boolean {
  if (!current) return false;
  return roles.includes(current);
} 