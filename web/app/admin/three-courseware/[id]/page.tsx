"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, Space, Typography, Button, Alert } from 'antd';
import dynamic from 'next/dynamic';

const ModelEditor3D = dynamic(()=>import('../_components/ModelEditor3D'), { ssr: false });
import Link from 'next/link';

export default function ThreeCoursewareEditorPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>三维课件编辑器</Typography.Title>
        <Link href="/admin/three-courseware"><Button>返回列表</Button></Link>
      </Space>
      <ModelEditor3D />
    </div>
  );
}


