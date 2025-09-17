import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '3D AI 课程',
  description: '沉浸式 3D AI 讲解课程',
};

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      margin: 0, 
      padding: 0,
      background: '#000',
      overflow: 'hidden'
    }}>
      {children}
    </div>
  );
}

