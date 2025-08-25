"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Alert } from "antd";

export const dynamic = 'force-dynamic';

function Inner() {
  const sp = useSearchParams();
  const src = sp.get('src') || '';
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    const existed = document.querySelector('script[data-model-viewer]');
    if (existed) { setReady(true); return; }
    const s = document.createElement('script');
    s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    s.setAttribute('data-model-viewer','1');
    s.onload = ()=>setReady(true);
    document.head.appendChild(s);
  },[]);

  if (!src) return <Alert type="error" message="缺少模型地址 src" />

  return (
    <Card title="模型预览 (GLB)">
      {!ready && <Alert type="info" message="正在加载组件..." />}
      {/* @ts-ignore: web component */}
      <model-viewer src={src}
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
