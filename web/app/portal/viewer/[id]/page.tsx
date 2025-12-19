"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spin, App, Button } from "antd";
import { apiGet } from "@/app/_utils/api";
import ModelExplorer from "@/app/course/[id]/components/ModelExplorer";

interface CoursewareDetail {
  _id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  modelUrl?: string;
  modifiedModelUrl?: string;
  annotations?: any[];
  hotspots?: any[];
  animations?: any[];
  settings?: any;
  modelStructure?: any;
}

export default function PortalViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { message } = App.useApp();
  
  const [loading, setLoading] = useState(true);
  const [courseware, setCourseware] = useState<CoursewareDetail | null>(null);
  const [error, setError] = useState<string>("");

  const coursewareId = params.id as string;

  // 加载课件数据
  useEffect(() => {
    if (coursewareId) {
      loadCourseware();
    }
  }, [coursewareId]);

  const loadCourseware = async () => {
    try {
      setLoading(true);
      // 使用 Portal API（学生可访问）
      const resp = await apiGet<CoursewareDetail>(`/api/portal/courseware/${coursewareId}`);
      // 将下载 URL 转换为公开接口，避免 403
      const toPublicModelUrl = (url?: string) => {
        if (!url) return url;
        const match = url.match(/\/api\/files\/([a-f0-9]{24})\/download/i);
        if (match) return `/api/files/public-model/${match[1]}`;
        // 兼容绝对地址（server:4000 等）
        try {
          if (/^https?:\/\//i.test(url)) {
            const u = new URL(url);
            return `${u.pathname}${u.search}`;
          }
        } catch {}
        return url;
      };

      setCourseware({
        ...resp,
        modelUrl: toPublicModelUrl(resp.modelUrl),
        modifiedModelUrl: toPublicModelUrl(resp.modifiedModelUrl),
      });
    } catch (e: any) {
      message.error(e?.message || '加载课件失败');
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a1a18'
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error || !courseware) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a1a18',
        color: '#fff'
      }}>
        <p>{error || '课件不存在'}</p>
        <Button onClick={() => router.push('/portal')}>返回课程列表</Button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <ModelExplorer
        coursewareData={courseware}
        onBack={() => router.back()}
      />
    </div>
  );
}

