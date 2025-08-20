"use client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
	const res = await fetch(`${API_URL}${path}`, {
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
	const res = await fetch(`${API_URL}${path}`, {
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