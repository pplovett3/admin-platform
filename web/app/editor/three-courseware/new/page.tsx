"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

// 新建三维课件页面 - 重定向到管理后台的新建页面
// 后续可以独立实现编辑器版本
export default function EditorNewCoursewarePage() {
  const router = useRouter();

  useEffect(() => {
    // 暂时重定向到管理后台的新建页面
    router.replace('/admin/three-courseware/new');
  }, [router]);

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

