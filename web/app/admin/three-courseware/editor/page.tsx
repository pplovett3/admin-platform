"use client";
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Alert, Card } from 'antd';

const ModelEditor3D = dynamic(()=>import('../_components/ModelEditor3D'), { ssr: false });

function Inner(){
  const sp = useSearchParams();
  const src = sp.get('src') || '';
  return (
    <ModelEditor3D initialUrl={src || undefined} />
  );
}

export default function QuickEditorPage(){
  return (
    <Suspense fallback={<Alert type="info" message="正在解析参数..." /> }>
      <Inner />
    </Suspense>
  );
}


