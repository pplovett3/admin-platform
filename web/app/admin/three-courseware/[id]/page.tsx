"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Spin, App, Typography, Space, Button } from 'antd';
import dynamic from 'next/dynamic';
import { apiGet } from '@/app/_utils/api';
import Link from 'next/link';

const ModelEditor3D = dynamic(()=>import('../_components/ModelEditor3D'), { ssr: false });

interface CoursewareData {
  _id: string;
  name: string;
  description: string;
  modelUrl: string;
  modifiedModelUrl?: string;
  annotations: any[];
  animations: any[];
  settings: any;
  version: number;
}

export default function ThreeCoursewareEditorPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const [courseware, setCourseware] = useState<CoursewareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { message } = App.useApp();

  useEffect(() => {
    if (!id) return;
    
    const loadCourseware = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet<CoursewareData>(`/api/coursewares/${id}`);
        setCourseware(data);
      } catch (e: any) {
        setError(e.message || '加载课件失败');
        message.error(e.message || '加载课件失败');
      } finally {
        setLoading(false);
      }
    };

    loadCourseware();
  }, [id, message]);

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Spin size="large" />
        <Typography.Text style={{ display: 'block', marginTop: 16 }}>
          正在加载课件数据...
        </Typography.Text>
      </div>
    );
  }

  if (error || !courseware) {
    return (
      <div style={{ padding: 16 }}>
        <Space style={{ marginBottom: 12 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>三维课件编辑器</Typography.Title>
          <Link href="/admin/three-courseware"><Button>返回列表</Button></Link>
        </Space>
        <Alert
          message="加载失败"
          description={error || '课件不存在或您没有访问权限'}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <ModelEditor3D 
      coursewareId={id}
      coursewareData={courseware}
      initialUrl={courseware.modelUrl}
    />
  );
}


