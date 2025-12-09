"use client";
import { useState, useEffect } from 'react';
import { Table, Card, Input, Button, Space, Tag, Progress, Statistic, Row, Col, Modal, Typography, message } from 'antd';
import { SearchOutlined, TrophyOutlined, TeamOutlined, FileTextOutlined, EyeOutlined, BarChartOutlined } from '@ant-design/icons';
import { authFetch } from '@/app/_lib/api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface CourseQuizStats {
  courseId: string;
  courseTitle: string;
  questionCount: number;
  attemptCount: number;
  studentCount: number;
  averageScore: number;
  passRate: number;
  createdAt: string;
}

interface QuizRecord {
  recordId: string;
  userId: string;
  userName: string;
  userPhone: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  completedAt: string;
  answers: any[];
}

interface CourseDetail {
  courseId: string;
  courseTitle: string;
  records: QuizRecord[];
  stats: {
    totalAttempts: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    passRate: number;
    uniqueStudents: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function QuizRecordsPage() {
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<CourseQuizStats[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  
  // 课程详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [courseDetail, setCourseDetail] = useState<CourseDetail | null>(null);
  const [detailPagination, setDetailPagination] = useState({ page: 1, limit: 10 });

  // 加载课程列表
  const loadCourses = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
        q: search
      });
      const res = await authFetch<any>(`/api/quiz/admin/stats?${params}`);
      setCourses(res.items || []);
      setPagination({
        page: res.pagination?.page || 1,
        limit: res.pagination?.limit || 10,
        total: res.pagination?.total || 0
      });
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载课程详情
  const loadCourseDetail = async (courseId: string, page = 1) => {
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(detailPagination.limit)
      });
      const res = await authFetch<CourseDetail>(`/api/quiz/admin/course/${courseId}?${params}`);
      setCourseDetail(res);
      setDetailPagination({
        page: res.pagination?.page || 1,
        limit: res.pagination?.limit || 10
      });
    } catch (e: any) {
      message.error(e?.message || '加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleSearch = () => {
    loadCourses(1, searchText);
  };

  const handleViewDetail = (courseId: string) => {
    setDetailVisible(true);
    loadCourseDetail(courseId);
  };

  // 课程列表列定义
  const courseColumns: ColumnsType<CourseQuizStats> = [
    {
      title: '课程名称',
      dataIndex: 'courseTitle',
      key: 'courseTitle',
      ellipsis: true,
      render: (text) => (
        <span style={{ fontWeight: 500 }}>{text}</span>
      )
    },
    {
      title: '题目数量',
      dataIndex: 'questionCount',
      key: 'questionCount',
      width: 100,
      align: 'center',
      render: (num) => (
        <Tag color="blue">{num} 题</Tag>
      )
    },
    {
      title: '答题人次',
      dataIndex: 'attemptCount',
      key: 'attemptCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.attemptCount - b.attemptCount
    },
    {
      title: '答题人数',
      dataIndex: 'studentCount',
      key: 'studentCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.studentCount - b.studentCount
    },
    {
      title: '平均分',
      dataIndex: 'averageScore',
      key: 'averageScore',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.averageScore - b.averageScore,
      render: (score) => (
        <span style={{ 
          color: score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f',
          fontWeight: 600
        }}>
          {score} 分
        </span>
      )
    },
    {
      title: '及格率',
      dataIndex: 'passRate',
      key: 'passRate',
      width: 150,
      align: 'center',
      sorter: (a, b) => a.passRate - b.passRate,
      render: (rate) => (
        <Progress 
          percent={rate} 
          size="small" 
          strokeColor={rate >= 80 ? '#52c41a' : rate >= 60 ? '#faad14' : '#ff4d4f'}
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record.courseId)}
        >
          查看详情
        </Button>
      )
    }
  ];

  // 答题记录列定义
  const recordColumns: ColumnsType<QuizRecord> = [
    {
      title: '学生姓名',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (text) => text || '未知用户'
    },
    {
      title: '手机号',
      dataIndex: 'userPhone',
      key: 'userPhone',
      width: 130,
      render: (text) => text || '-'
    },
    {
      title: '得分',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.score - b.score,
      render: (score) => (
        <span style={{ 
          color: score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f',
          fontWeight: 600,
          fontSize: '16px'
        }}>
          {score}
        </span>
      )
    },
    {
      title: '正确/总题',
      key: 'correctRate',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <span>
          <span style={{ color: '#52c41a' }}>{record.correctCount}</span>
          <span style={{ color: '#999' }}> / {record.totalQuestions}</span>
        </span>
      )
    },
    {
      title: '答题时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      align: 'center',
      render: (_, record) => (
        record.score >= 60 
          ? <Tag color="success">及格</Tag>
          : <Tag color="error">不及格</Tag>
      )
    }
  ];

  // 计算总体统计
  const totalStats = {
    totalCourses: courses.length,
    totalAttempts: courses.reduce((sum, c) => sum + c.attemptCount, 0),
    totalStudents: courses.reduce((sum, c) => sum + c.studentCount, 0),
    avgPassRate: courses.length > 0 
      ? Math.round(courses.reduce((sum, c) => sum + c.passRate, 0) / courses.length) 
      : 0
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={4} style={{ marginBottom: '24px' }}>
        <BarChartOutlined style={{ marginRight: '8px' }} />
        成绩管理
      </Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="有考题的课程" 
              value={totalStats.totalCourses} 
              prefix={<FileTextOutlined />}
              suffix="门"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="总答题人次" 
              value={totalStats.totalAttempts} 
              prefix={<TeamOutlined />}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="答题学生数" 
              value={totalStats.totalStudents} 
              prefix={<TeamOutlined />}
              suffix="人"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="平均及格率" 
              value={totalStats.avgPassRate} 
              prefix={<TrophyOutlined />}
              suffix="%"
              valueStyle={{ color: totalStats.avgPassRate >= 60 ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索栏 */}
      <Card style={{ marginBottom: '16px' }}>
        <Space>
          <Input
            placeholder="搜索课程名称..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
        </Space>
      </Card>

      {/* 课程列表 */}
      <Card title="课程答题统计">
        <Table
          columns={courseColumns}
          dataSource={courses}
          rowKey="courseId"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 门课程`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, page, limit: pageSize || 10 });
              loadCourses(page, searchText);
            }
          }}
        />
      </Card>

      {/* 课程详情弹窗 */}
      <Modal
        title={
          <Space>
            <TrophyOutlined />
            {courseDetail?.courseTitle || '课程成绩详情'}
          </Space>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={900}
      >
        {courseDetail && (
          <>
            {/* 统计信息 */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
              <Col span={4}>
                <Statistic 
                  title="答题人次" 
                  value={courseDetail.stats.totalAttempts} 
                />
              </Col>
              <Col span={4}>
                <Statistic 
                  title="答题人数" 
                  value={courseDetail.stats.uniqueStudents} 
                />
              </Col>
              <Col span={4}>
                <Statistic 
                  title="平均分" 
                  value={courseDetail.stats.averageScore}
                  suffix="分"
                  valueStyle={{ 
                    color: courseDetail.stats.averageScore >= 60 ? '#52c41a' : '#ff4d4f' 
                  }}
                />
              </Col>
              <Col span={4}>
                <Statistic 
                  title="最高分" 
                  value={courseDetail.stats.highestScore}
                  suffix="分"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={4}>
                <Statistic 
                  title="最低分" 
                  value={courseDetail.stats.lowestScore}
                  suffix="分"
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={4}>
                <Statistic 
                  title="及格率" 
                  value={courseDetail.stats.passRate}
                  suffix="%"
                  valueStyle={{ 
                    color: courseDetail.stats.passRate >= 60 ? '#52c41a' : '#ff4d4f' 
                  }}
                />
              </Col>
            </Row>

            {/* 答题记录列表 */}
            <Table
              columns={recordColumns}
              dataSource={courseDetail.records}
              rowKey="recordId"
              loading={detailLoading}
              size="small"
              pagination={{
                current: detailPagination.page,
                pageSize: detailPagination.limit,
                total: courseDetail.pagination?.total || 0,
                showTotal: (total) => `共 ${total} 条记录`,
                onChange: (page) => {
                  setDetailPagination({ ...detailPagination, page });
                  if (courseDetail.courseId) {
                    loadCourseDetail(courseDetail.courseId, page);
                  }
                }
              }}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

