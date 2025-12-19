"use client";
import { useEffect, useState } from 'react';
import { Card, Tabs, Table, Empty, Progress, Tag, Spin } from 'antd';
import { TrophyOutlined, BookOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { apiGet } from '@/app/_utils/api';
import { getToken, parseJwt } from '@/app/_utils/auth';
import Link from 'next/link';

interface QuizRecord {
  courseId: string;
  courseTitle?: string;
  sharePath?: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  completedAt: string;
}

interface LearningStats {
  totalCourses: number;
  completedCourses: number;
  totalQuizzes: number;
  averageScore: number;
}

export default function MyStudyPage() {
  const [loading, setLoading] = useState(true);
  const [quizRecords, setQuizRecords] = useState<QuizRecord[]>([]);
  const [stats, setStats] = useState<LearningStats>({
    totalCourses: 0,
    completedCourses: 0,
    totalQuizzes: 0,
    averageScore: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // 获取用户的学习记录
      const resp = await apiGet<{ records: QuizRecord[], stats: LearningStats }>('/api/portal/my-study');
      setQuizRecords(resp.records || []);
      setStats(resp.stats || {
        totalCourses: 0,
        completedCourses: 0,
        totalQuizzes: 0,
        averageScore: 0,
      });
    } catch (error) {
      console.error('加载学习记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '课程名称',
      dataIndex: 'courseTitle',
      key: 'courseTitle',
      render: (text: string, record: QuizRecord) => (
        <Link href={record.sharePath || `/portal/course/${record.courseId}`} style={{ color: '#10b981' }}>
          {text || '未知课程'}
        </Link>
      ),
    },
    {
      title: '得分',
      dataIndex: 'score',
      key: 'score',
      width: 120,
      render: (score: number) => {
        let color = '#52c41a';
        if (score < 60) color = '#ff4d4f';
        else if (score < 80) color = '#faad14';
        return (
          <span style={{ color, fontWeight: 600, fontSize: 16 }}>
            {score}分
          </span>
        );
      },
    },
    {
      title: '正确/总题数',
      key: 'questions',
      width: 120,
      render: (_: any, record: QuizRecord) => (
        <span>
          <span style={{ color: '#52c41a', fontWeight: 500 }}>{record.correctCount}</span>
          <span style={{ color: '#999' }}> / {record.totalQuestions}</span>
        </span>
      ),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: any, record: QuizRecord) => (
        record.score >= 60 
          ? <Tag color="success" icon={<CheckCircleOutlined />}>及格</Tag>
          : <Tag color="error">未及格</Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '32px 48px' }}>
      <h1 style={{ 
        fontSize: 28, 
        fontWeight: 600, 
        color: '#fff',
        marginBottom: 32,
        textShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        我的学习
      </h1>

      {/* 统计卡片 - 深色毛玻璃风格 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 24,
        marginBottom: 32
      }}>
        <Card style={{ 
          borderRadius: 16,
          background: 'rgba(16, 185, 129, 0.08)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BookOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>学习课程</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                {stats.totalCourses}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ 
          borderRadius: 16,
          background: 'rgba(16, 185, 129, 0.08)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>完成课程</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                {stats.completedCourses}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ 
          borderRadius: 16,
          background: 'rgba(16, 185, 129, 0.08)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <TrophyOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>答题次数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                {stats.totalQuizzes}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ 
          borderRadius: 16,
          background: 'rgba(16, 185, 129, 0.08)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <TrophyOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>平均分数</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                {stats.averageScore.toFixed(1)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 成绩记录 - 深色毛玻璃风格 */}
      <Card 
        title={
          <span style={{ fontWeight: 600, color: '#fff' }}>
            <TrophyOutlined style={{ marginRight: 8, color: '#10b981' }} />
            成绩记录
          </span>
        }
        style={{ 
          borderRadius: 16,
          background: 'rgba(16, 185, 129, 0.08)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}
        styles={{ header: { borderBottom: '1px solid rgba(16, 185, 129, 0.2)' } }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : quizRecords.length === 0 ? (
          <Empty description="暂无成绩记录，快去学习吧！" />
        ) : (
          <Table
            dataSource={quizRecords}
            columns={columns}
            rowKey={(record) => `${record.courseId}-${record.completedAt}`}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
    </div>
  );
}

