"use client";
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Alert, Card } from 'antd';
import { getAPI_URL } from '@/app/_lib/api';

const ModelEditor3D = dynamic(()=>import('../_components/ModelEditor3D'), { ssr: false });

function Inner(){
  const sp = useSearchParams();
  const src = sp.get('src') || '';
  const proxied = (() => {
    try {
      if (!src) return '';
      const u = new URL(src);
      // 仅对指定域名进行代理，以绕过跨域下载限制
      const allow = new Set(['video.yf-xr.com','dl.yf-xr.com']);
      if (allow.has(u.hostname)) {
        // 使用动态获取的API URL，如果是公网域名则使用相对路径（通过 Next.js rewrites）
        const apiBase = getAPI_URL();
        const base = (apiBase || '').replace(/\/$/, '');
        return `${base}/api/files/proxy?url=${encodeURIComponent(src)}`;
      }
      return src;
    } catch { return src; }
  })();
  return <ModelEditor3D initialUrl={proxied || undefined} />;
}

export default function QuickEditorPage(){
  return (
    <Suspense fallback={<Alert type="info" message="正在解析参数..." /> }>
      <Inner />
    </Suspense>
  );
}



