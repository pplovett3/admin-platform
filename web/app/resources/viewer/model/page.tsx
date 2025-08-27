"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Alert } from "antd";
import { getToken } from "../../../_lib/api";

export const dynamic = 'force-dynamic';

function Inner() {
  const sp = useSearchParams();
  const src = sp.get('src') || '';
  const [ready, setReady] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [expectAuthFetch, setExpectAuthFetch] = useState<boolean>(false);
  const canRender = ready && (!expectAuthFetch || !!blobUrl);

  useEffect(()=>{
    if (typeof window !== 'undefined' && (window as any).customElements?.get('model-viewer')) {
      setReady(true);
      return;
    }
    const existed = document.querySelector('script[data-model-viewer]');
    if (existed) { setReady(true); return; }
    // Module build
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    s.setAttribute('data-model-viewer','1');
    s.onload = ()=>setReady(true);
    s.onerror = ()=>{ setReady(false); };
    document.head.appendChild(s);
    // Legacy fallback for browsers not supporting ESM
    const sLegacy = document.createElement('script');
    (sLegacy as any).noModule = true;
    sLegacy.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer-legacy.js';
    sLegacy.setAttribute('data-model-viewer','1');
    sLegacy.onload = ()=>setReady(true);
    document.head.appendChild(sLegacy);
  },[]);

  useEffect(()=>{
    setErr("");
    setBlobUrl("");
    if (!src) return;
    try {
      const url = new URL(src, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
      const isApiDownload = /\/api\/files\/.+\/download/i.test(url.pathname);
      if (isApiDownload) {
        setExpectAuthFetch(true);
        const token = getToken();
        (async()=>{
          try {
            const res = await fetch(url.toString(), { headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
            if (!res.ok) {
              let msg = `下载失败: ${res.status}`;
              try { const j = await res.json(); if ((j as any)?.message) msg = (j as any).message; } catch {}
              throw new Error(msg);
            }
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
          } catch(e:any){ setErr(e?.message||'下载失败'); }
        })();
      } else {
        setExpectAuthFetch(false);
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
      {canRender && (
        // @ts-ignore: web component
        <model-viewer src={expectAuthFetch ? blobUrl : (blobUrl || src)}
          crossorigin="anonymous"
          style={{ width: '100%', height: '70vh', background: '#111' }}
          camera-controls
          exposure="1"
          shadow-intensity="1"
          autoplay
        ></model-viewer>
      )}
      {expectAuthFetch && !blobUrl && !err && <Alert type="info" message="正在下载模型..." />}
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
