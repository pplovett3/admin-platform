"use client";
import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button } from 'antd';
import { 
  FileOutlined, 
  AppstoreOutlined, 
  ExperimentOutlined,
  PlusOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { apiGet } from '@/app/_utils/api';
import { useRouter } from 'next/navigation';

interface EditorStats {
  totalCoursewares: number;
  totalAiCourses: number;
  totalResources: number;
  pendingReview: number;
}

export default function EditorHomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<EditorStats>({
    totalCoursewares: 0,
    totalAiCourses: 0,
    totalResources: 0,
    pendingReview: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // 获取编辑器统计数据
      const [coursewares, aiCourses] = await Promise.all([
        apiGet<{ pagination: { total: number } }>('/api/coursewares?limit=1'),
        apiGet<{ pagination: { total: number } }>('/api/ai-courses?limit=1'),
      ]);
      
      setStats({
        totalCoursewares: coursewares.pagination?.total || 0,
        totalAiCourses: aiCourses.pagination?.total || 0,
        totalResources: 0,
        pendingReview: 0,
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const quickActions = [
    {
      title: '新建三维课件',
      description: '上传3D模型，添加标注和动画',
      icon: <AppstoreOutlined style={{ fontSize: 32 }} />,
      color: '#8b5cf6',
      onClick: () => router.push('/editor/three-courseware/new'),
    },
    {
      title: '新建AI课件',
      description: '基于三维课件创建AI讲解课程',
      icon: <ExperimentOutlined style={{ fontSize: 32 }} />,
      color: '#f59e0b',
      onClick: () => router.push('/editor/ai-course/new'),
    },
    {
      title: '管理资源',
      description: '上传和管理3D模型、图片等资源',
      icon: <FileOutlined style={{ fontSize: 32 }} />,
      color: '#10b981',
      onClick: () => router.push('/editor/resources'),
    },
  ];

  return (
    <div style={{ padding: 32 }}>
      {/* 欢迎区域 */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ 
          fontSize: 28, 
          fontWeight: 600, 
          color: '#fff',
          marginBottom: 8
        }}>
          三维课件编辑器
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
          创建沉浸式三维交互课程内容
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={24} style={{ marginBottom: 40 }}>
        <Col span={6}>
          <Card 
            style={{ 
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.1) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 16,
            }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>三维课件</span>}
              value={stats.totalCoursewares}
              valueStyle={{ color: '#8b5cf6', fontWeight: 600 }}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            style={{ 
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 16,
            }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>AI课件</span>}
              value={stats.totalAiCourses}
              valueStyle={{ color: '#f59e0b', fontWeight: 600 }}
              prefix={<ExperimentOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            style={{ 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 16,
            }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>资源文件</span>}
              value={stats.totalResources}
              valueStyle={{ color: '#10b981', fontWeight: 600 }}
              prefix={<FileOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            style={{ 
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(190, 24, 93, 0.1) 100%)',
              border: '1px solid rgba(236, 72, 153, 0.3)',
              borderRadius: 16,
            }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.7)' }}>待审核</span>}
              value={stats.pendingReview}
              valueStyle={{ color: '#ec4899', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <h2 style={{ 
        fontSize: 18, 
        fontWeight: 600, 
        color: '#fff',
        marginBottom: 20
      }}>
        快速开始
      </h2>
      <Row gutter={24}>
        {quickActions.map((action, index) => (
          <Col span={8} key={index}>
            <Card
              hoverable
              onClick={action.onClick}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              styles={{ body: { padding: 24 } }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${action.color}33 0%, ${action.color}1a 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: action.color,
                }}>
                  {action.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ 
                    color: '#fff', 
                    fontSize: 16, 
                    fontWeight: 600,
                    marginBottom: 4 
                  }}>
                    {action.title}
                  </h3>
                  <p style={{ 
                    color: 'rgba(255,255,255,0.5)', 
                    fontSize: 13,
                    marginBottom: 12
                  }}>
                    {action.description}
                  </p>
                  <Button 
                    type="link" 
                    style={{ color: action.color, padding: 0 }}
                    icon={<ArrowRightOutlined />}
                  >
                    开始创建
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 最近编辑 */}
      <h2 style={{ 
        fontSize: 18, 
        fontWeight: 600, 
        color: '#fff',
        marginTop: 40,
        marginBottom: 20
      }}>
        最近编辑
      </h2>
      <Card
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
        }}
      >
        <div style={{ 
          textAlign: 'center', 
          padding: 40,
          color: 'rgba(255,255,255,0.4)'
        }}>
          暂无最近编辑的课件
        </div>
      </Card>
    </div>
  );
}

