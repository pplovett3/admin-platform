"use client";
import { useEffect, useMemo, useState } from 'react';
import { App, Card, Col, Row, Select, Statistic, Table, Typography } from 'antd';
import { apiGet } from '@/app/_utils/api';
import { getToken, parseJwt, Role } from '@/app/_utils/auth';

export default function AnalyticsRolePage() {
  const { message } = App.useApp();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const role: Role | undefined = useMemo(() => parseJwt(getToken())?.role, []);

  // shared states
  const [trendDays, setTrendDays] = useState<number>(14);

  // school admin
  const [schoolOverview, setSchoolOverview] = useState<any>(null);
  const [schoolTrend, setSchoolTrend] = useState<any[]>([]);
  const [schoolTop, setSchoolTop] = useState<any[]>([]);

  // teacher
  const [teacherOverview, setTeacherOverview] = useState<any>(null);
  const [teacherTrend, setTeacherTrend] = useState<any[]>([]);
  const [teacherTop, setTeacherTop] = useState<any[]>([]);

  // student
  const [studentOverview, setStudentOverview] = useState<any>(null);
  const [studentTrend, setStudentTrend] = useState<any[]>([]);
  const [myLogs, setMyLogs] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        if (role === 'schoolAdmin') {
          const [ov, tr, top] = await Promise.all([
            apiGet<any>('/api/analytics/school/overview'),
            apiGet<any[]>(`/api/analytics/school/trend/sessions?days=${trendDays}`),
            apiGet<any[]>(`/api/analytics/school/top/courses?metric=sessions&limit=10`),
          ]);
          setSchoolOverview(ov); setSchoolTrend(tr || []); setSchoolTop(top || []);
        }
        if (role === 'teacher') {
          const [ov, tr, top] = await Promise.all([
            apiGet<any>('/api/analytics/teacher/overview'),
            apiGet<any[]>(`/api/analytics/teacher/trend/sessions?days=${trendDays}`),
            apiGet<any[]>(`/api/analytics/teacher/top/courses?metric=sessions&limit=10`),
          ]);
          setTeacherOverview(ov); setTeacherTrend(tr || []); setTeacherTop(top || []);
        }
        if (role === 'student') {
          const [ov, tr, logs] = await Promise.all([
            apiGet<any>('/api/analytics/student/overview'),
            apiGet<any[]>(`/api/analytics/student/trend/sessions?days=${trendDays}`),
            apiGet<any[]>(`/api/timelog/my/logs?days=30&limit=100`),
          ]);
          setStudentOverview(ov); setStudentTrend(tr || []); setMyLogs(logs || []);
        }
      } catch (e: any) {
        message.error(e.message);
      }
    };
    if (mounted) run();
  }, [mounted, role, trendDays]);

  if (!mounted) return null;

  if (role === 'schoolAdmin') {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Title level={3}>学校总览</Typography.Title>
        <Row gutter={12}>
          <Col span={6}><Card><Statistic title="授权课程数" value={schoolOverview?.authorizedCourseCount || 0} /></Card></Col>
          <Col span={6}><Card><Statistic title="教师数" value={schoolOverview?.teacherCount || 0} /></Card></Col>
          <Col span={6}><Card><Statistic title="学生数" value={schoolOverview?.studentCount || 0} /></Card></Col>
          <Col span={6}><Card><Statistic title="学习人次" value={schoolOverview?.totalSessions || 0} /></Card></Col>
        </Row>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={24}>
            <Card title={<div>趋势（<Select size="small" value={trendDays} onChange={setTrendDays} options={[{value:7,label:'近7天'},{value:14,label:'近14天'},{value:30,label:'近30天'}]} />）</div>}>
              <Table size="small" rowKey={(r)=>r.day} pagination={false} dataSource={schoolTrend} columns={[
                { key: 'day', title: '日期', dataIndex: 'day' },
                { key: 'sessions', title: '学习人次', dataIndex: 'sessions' },
                { key: 'activeUsers', title: '活跃学生数', dataIndex: 'activeUsers' },
              ] as any} />
            </Card>
          </Col>
        </Row>
        <Typography.Title level={4} style={{ marginTop: 16 }}>Top课程（按人次）</Typography.Title>
        <Table size="small" rowKey={(r)=>r?.course?._id || `${r?.course?.name}-${r?.sessions}` } pagination={false} dataSource={schoolTop} columns={[
          { key: 'name', title: '课程', dataIndex: ['course','name'] },
          { key: 'sessions', title: '学习人次', dataIndex: 'sessions' },
        ] as any} />
      </div>
    );
  }

  if (role === 'teacher') {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Title level={3}>班级总览</Typography.Title>
        <Row gutter={12}>
          <Col span={6}><Card><Statistic title="我的班级数" value={teacherOverview?.classesCount || 0} /></Card></Col>
          <Col span={6}><Card><Statistic title="学生数" value={teacherOverview?.students || 0} /></Card></Col>
          <Col span={6}><Card><Statistic title="学习人次" value={teacherOverview?.totalSessions || 0} /></Card></Col>
          <Col span={6}><Card><Statistic title="本校授权课程数" value={teacherOverview?.authorizedCourseCount || 0} /></Card></Col>
        </Row>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={24}>
            <Card title={<div>趋势（<Select size="small" value={trendDays} onChange={setTrendDays} options={[{value:7,label:'近7天'},{value:14,label:'近14天'},{value:30,label:'近30天'}]} />）</div>}>
              <Table size="small" rowKey={(r)=>r.day} pagination={false} dataSource={teacherTrend} columns={[
                { key: 'day', title: '日期', dataIndex: 'day' },
                { key: 'sessions', title: '学习人次', dataIndex: 'sessions' },
                { key: 'activeUsers', title: '活跃学生数', dataIndex: 'activeUsers' },
              ] as any} />
            </Card>
          </Col>
        </Row>
        <Typography.Title level={4} style={{ marginTop: 16 }}>Top课程（按人次）</Typography.Title>
        <Table size="small" rowKey={(r)=>r?.course?._id || `${r?.course?.name}-${r?.sessions}` } pagination={false} dataSource={teacherTop} columns={[
          { key: 'name', title: '课程', dataIndex: ['course','name'] },
          { key: 'sessions', title: '学习人次', dataIndex: 'sessions' },
        ] as any} />
      </div>
    );
  }

  // student
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3}>我的学习</Typography.Title>
      <Row gutter={12}>
        <Col span={6}><Card><Statistic title="本校授权课程数" value={studentOverview?.authorizedCourseCount || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="我的学习人次" value={studentOverview?.mySessions || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="我的提交次数" value={studentOverview?.mySubmissions || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="参与课程数" value={studentOverview?.participatedCourses || 0} /></Card></Col>
      </Row>
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={24}>
          <Card title={<div>趋势（<Select size="small" value={trendDays} onChange={setTrendDays} options={[{value:7,label:'近7天'},{value:14,label:'近14天'},{value:30,label:'近30天'}]} />）</div>}>
            <Table size="small" rowKey={(r)=>r.day} pagination={false} dataSource={studentTrend} columns={[
              { key: 'day', title: '日期', dataIndex: 'day' },
              { key: 'sessions', title: '学习人次', dataIndex: 'sessions' },
            ] as any} />
          </Card>
        </Col>
      </Row>

      <Typography.Title level={4} style={{ marginTop: 16 }}>学习记录</Typography.Title>
      <Table
        size="small"
        rowKey={(r)=>r._id}
        dataSource={myLogs}
        pagination={{ pageSize: 10 }}
        columns={[
          { key: 'courseName', title: '课程', dataIndex: 'courseName', render: (v:any, r:any)=> v || r.courseCode || '未知课程' },
          { key: 'startedAt', title: '开始时间', dataIndex: 'startedAt', render: (v:any)=> new Date(v).toLocaleString() },
          { key: 'durationSec', title: '学习时长', dataIndex: 'durationSec', render: (v:number)=> `${Math.floor((v||0)/60)}分${(v||0)%60}秒` },
        ] as any}
      />
    </div>
  );
} 