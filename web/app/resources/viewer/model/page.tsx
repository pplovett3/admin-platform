"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Alert } from "antd";

export const dynamic = 'force-dynamic';

function Inner() {
  const sp = useSearchParams();
  const src = sp.get('src') || '';
  const [ready, setReady] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [err, setErr] = useState<string>("");

  useEffect(()=>{
    const existed = document.querySelector('script[data-model-viewer]');
    if (existed) { setReady(true); return; }
    const s = document.createElement('script');
    s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    s.setAttribute('data-model-viewer','1');
    s.onload = ()=>setReady(true);
    document.head.appendChild(s);
  },[]);

  useEffect(()=>{
    setErr("");
    setBlobUrl("");
    if (!src) return;
    try {
      const url = new URL(src, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
      const sameOrigin = typeof window !== 'undefined' ? url.origin === window.location.origin : true;
      const isApiDownload = /\/api\/files\/.+\/download/i.test(url.pathname);
      if (sameOrigin && isApiDownload) {
        const token = (typeof localStorage !== 'undefined' && (localStorage.getItem('token')||localStorage.getItem('authToken'))) || '';
        (async()=>{
          try {
            const res = await fetch(url.toString(), { headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
            if (!res.ok) { throw new Error(`下载失败: ${res.status}`); }
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
          } catch(e:any){ setErr(e?.message||'下载失败'); }
        })();
      } else {
        setBlobUrl("");
      }
    } catch(e:any){ setErr(e?.message||'URL 解析失败'); }
    return () => { if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch {} } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!src) return <Alert type="error" message="缺少模型地址 src" />

  return (
    <Card title="模型预览 (GLB)">
      {!ready && <Alert type="info" message="正在加载组件..." />}
      {err && <Alert type="error" message={err} />}
      {/* @ts-ignore: web component */}
      <model-viewer src={blobUrl || src}
        style={{ width: '100%', height: '70vh', background: '#111' }}
        camera-controls
        exposure="1"
        shadow-intensity="1"
        autoplay
      ></model-viewer>
    </Card>
  );
}

export default function ModelViewerPage() {
  return (
    <Suspense fallback={<Alert type="info" message="正在解析参数..." />}> 
      <Inner />
    </Suspense>
  );
}
