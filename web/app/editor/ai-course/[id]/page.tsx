"use client";
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Spin } from 'antd';

// 编辑AI课件页面 - 重定向到管理后台的编辑页面
// 后续可以独立实现编辑器版本
export default function EditorAICourseEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    if (id) {
      // 暂时重定向到管理后台的编辑页面
      router.replace(`/admin/ai-course/${id}`);
    }
  }, [router, id]);

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Spin size="large" tip="正在加载编辑器..." />
    </div>
  );
}

