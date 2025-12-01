"use client";

// 动态获取 API URL：使用相对路径通过 Next.js rewrites 代理
// 注意：这个函数在每次调用时都会重新计算，确保使用最新的 hostname
export function getAPI_URL(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // 优先检测公网域名，使用相对路径（通过 Next.js rewrites）
    if (hostname.includes('yf-xr.com') || hostname.includes('platform')) {
      console.log('[API_URL] 检测到公网域名，使用相对路径:', hostname);
      return ''; // 使用相对路径，Next.js 会自动代理到后端
    }
    // 本地开发环境：localhost 或 127.0.0.1，使用 localhost:4000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log('[API_URL] 检测到本地环境，使用 localhost:4000');
      return 'http://localhost:4000';
    }
    // 其他情况（内网IP等），使用当前域名
    console.log('[API_URL] 使用当前域名:', window.location.origin);
    return window.location.origin;
  }
  // SSR 时使用配置的环境变量或 localhost
  return (process.env.NEXT_PUBLIC_API_URL || '').trim() || "http://localhost:4000";
}

// 为了兼容性，保留原来的常量形式，但改为函数调用
export const API_URL = getAPI_URL();

export function getToken(): string {
	try {
		return (
			localStorage.getItem("token") ||
			localStorage.getItem("authToken") ||
			""
		);
	} catch {
		return "";
	}
}

export function getCurrentRole(): string | undefined {
	const t = getToken();
	if (!t) return undefined;
	const parts = t.split(".");
	if (parts.length < 2) return undefined;
	try {
		const json = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
		return json?.role;
	} catch {
		return undefined;
	}
}

export async function authFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
	const token = getToken();
	// 每次调用时重新获取 API_URL，确保使用最新的 hostname
	const apiUrl = getAPI_URL();
	const fullUrl = `${apiUrl}${path}`;
	console.log('[authFetch] API URL:', apiUrl, 'Full URL:', fullUrl);
	const res = await fetch(fullUrl, {
		...init,
		headers: {
			"Authorization": token ? `Bearer ${token}` : "",
			...(init.headers || {}),
		},
		cache: "no-store",
	});
	if (!res.ok) {
		let message = `${res.status}`;
		try { const j = await res.json(); message = (j as any).message || message; } catch {}
		throw new Error(message);
	}
	try { return (await res.json()) as T; } catch { return undefined as unknown as T; }
}

export async function authDownload(path: string, filename?: string): Promise<void> {
	// If it's an absolute URL (e.g., dl.yf-xr.com / video.yf-xr.com), open directly
	if (/^https?:\/\//i.test(path)) {
		const a = document.createElement('a');
		a.href = path;
		if (filename) a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		return;
	}
	const token = getToken();
	// 每次调用时重新获取 API_URL，确保使用最新的 hostname
	const apiUrl = getAPI_URL();
	const fullUrl = `${apiUrl}${path}`;
	console.log('[authDownload] API URL:', apiUrl, 'Full URL:', fullUrl);
	const res = await fetch(fullUrl, {
		headers: { Authorization: token ? `Bearer ${token}` : "" },
	});
	if (!res.ok) {
		let message = `${res.status}`;
		try { const j = await res.json(); message = (j as any).message || message; } catch {}
		throw new Error(message);
	}
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename || "download";
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
} 