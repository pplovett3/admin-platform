"use client";
import { useEffect, useState, useMemo } from 'react';
import { Card, Typography, Statistic, Row, Col, Table, Select, App, Radio, Space } from 'antd';
import { apiGet } from '@/app/_utils/api';
import dynamic from 'next/dynamic';

const Line = dynamic(() => import('@ant-design/plots').then(m => m.Line as any), { ssr: false });
const Pie = dynamic(() => import('@ant-design/plots').then(m => m.Pie as any), { ssr: false });
const Bar = dynamic(() => import('@ant-design/plots').then(m => m.Bar as any), { ssr: false });
const Column = dynamic(() => import('@ant-design/plots').then(m => m.Column as any), { ssr: false });

export default function AnalyticsPage() {
  const { message } = App.useApp();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [overview, setOverview] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState<string>('');
  const [courseDetail, setCourseDetail] = useState<any>(null);

  // analytics data
  const [trendDays, setTrendDays] = useState<number>(14);
  const [trend, setTrend] = useState<any[]>([]);
  const [topMetric, setTopMetric] = useState<'sessions' | 'submissions'>('sessions');
  const [topCourses, setTopCourses] = useState<any[]>([]);
  // topSchools 由 schools 聚合直接计算，确保包含 0

  const load = async () => {
    try {
      const [ov, ss, cs] = await Promise.all([
        apiGet<any>('/api/analytics/overview'),
        apiGet<any[]>('/api/analytics/schools'),
        apiGet<any[]>('/api/courses'),
      ]);
      setOverview(ov); setSchools(ss || []); setCourses(cs || []);
      if (!courseId && (cs || []).length > 0) setCourseId(cs[0]._id);
    } catch (e: any) { message.error(e.message); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const run = async () => {
      if (!courseId) return; setCourseDetail(null);
      try { const d = await apiGet<any>(`/api/analytics/courses/${courseId}`); setCourseDetail(d); } catch (e: any) { message.error(e.message); }
    };
    run();
  }, [courseId]);

  // trend sessions + active users in one dataset (server returns both, but may miss zero-days)
  useEffect(() => {
    const run = async () => {
      try {
        const data = await apiGet<any[]>(`/api/analytics/trend/sessions?days=${trendDays}`);
        setTrend(Array.isArray(data) ? data : []);
      } catch (e: any) { message.error(e.message); }
    };
    run();
  }, [trendDays]);

  // tops
  useEffect(() => {
    const run = async () => {
      try {
        const list = await apiGet<any[]>(`/api/analytics/top/courses?metric=${topMetric}&limit=10`);
        setTopCourses(list || []);
      } catch (e: any) { message.error(e.message); }
    };
    run();
  }, [topMetric]);

  // no need to call extra API for top schools

  // computed values
  const courseTotal = useMemo(() => (overview?.courseCountByType?.simple || 0) + (overview?.courseCountByType?.modular || 0), [overview]);

  // Top学校（前5），即使为 0 也包含
  const topSchoolsRows = useMemo(() => {
    const list = (schools || []).map((s: any) => ({ schoolId: s.schoolId, name: s.name, sessions: s.sessions || 0 }));
    return list.sort((a, b) => b.sessions - a.sessions).slice(0, 5);
  }, [schools]);

  // fill missing days with zeros for sessions / activeUsers
  const filledTrend = useMemo(() => {
    const days = trendDays;
    const today = new Date();
    const dayFmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const map = new Map((trend || []).map((t: any) => [t.day, t]));
    const out: any[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = dayFmt(d);
      const row = map.get(key);
      out.push({ day: key, sessions: row?.sessions || 0, activeUsers: row?.activeUsers || 0 });
    }
    return out;
  }, [trend, trendDays]);

  // charts configs with dark-friendly styles
  const commonAxis = { label: { style: { fill: '#c7d2fe' } }, title: null, grid: { line: { style: { stroke: 'rgba(255,255,255,0.08)' } } } } as any;
  const commonLegend = { itemName: { style: { fill: '#c7d2fe' } } } as any;
  const commonTooltip = { domStyles: { 'g2-tooltip': { color: '#0b1220' } } } as any;

  const sessionsLine = useMemo(() => ({
    data: filledTrend,
    xField: 'day',
    yField: 'sessions',
    theme: 'classicDark',
    xAxis: commonAxis,
    yAxis: commonAxis,
    legend: false,
    smooth: true,
    point: { size: 3, shape: 'circle', style: { stroke: '#22d3ee', fill: '#22d3ee' } },
    lineStyle: { stroke: '#22d3ee' },
    meta: { sessions: { alias: '人次' } },
  }), [filledTrend]);

  const activeLine = useMemo(() => ({
    data: filledTrend.map(d => ({ day: d.day, value: d.activeUsers })),
    xField: 'day',
    yField: 'value',
    theme: 'classicDark',
    xAxis: commonAxis,
    yAxis: commonAxis,
    legend: false,
    smooth: true,
    point: { size: 3, shape: 'circle', style: { stroke: '#34d399', fill: '#34d399' } },
    lineStyle: { stroke: '#34d399' },
    meta: { value: { alias: '活跃学生数' } },
  }), [filledTrend]);

  const coursePieConfig = useMemo(() => ({
    data: [
      { type: 'simple', value: overview?.courseCountByType?.simple || 0 },
      { type: 'modular', value: overview?.courseCountByType?.modular || 0 },
    ],
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    innerRadius: 0.6,
    label: false,
    color: ['#38bdf8', '#34d399'],
    legend: commonLegend,
    theme: 'classicDark',
  }), [overview]);

  const topBarConfig = useMemo(() => ({
    data: (topCourses || []).map((t: any) => ({ name: t?.course?.name || '未知', value: t?.[topMetric] || 0 }))
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5),
    xField: 'name',
    yField: 'value',
    theme: 'classicDark',
    xAxis: { ...commonAxis, label: { style: { fill: '#c7d2fe' } } },
    yAxis: { ...commonAxis, grid: null, label: { formatter: (v: any) => `${v}` , style: { fill: '#c7d2fe' } } },
    legend: false,
    seriesField: undefined,
    columnStyle: { radius: [4, 4, 0, 0] },
    color: ['#22d3ee', '#34d399', '#60a5fa', '#a78bfa', '#f59e0b'],
    meta: { value: { alias: topMetric === 'sessions' ? '人次' : '提交次数' } },
  }), [topCourses, topMetric]);

  if (!mounted) return null;

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3}>平台总览</Typography.Title>
      <Row gutter={12}>
        <Col span={4}><Card><Statistic title="学校数" value={overview?.schoolCount || 0} /></Card></Col>
        <Col span={4}><Card><Statistic title="课程数" value={courseTotal || 0} /></Card></Col>
        <Col span={4}><Card><Statistic title="学生数" value={overview?.studentCount || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="成绩提交总次数" value={overview?.totalScoreSubmissions || 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="学习人次（会话数）" value={overview?.totalSessions || 0} /></Card></Col>
      </Row>

      <Typography.Title level={3} style={{ marginTop: 24 }}>趋势与活跃</Typography.Title>
      <Row gutter={12}>
        <Col span={16}>
          <Card title={<Space><span>学习人次趋势</span><Select size="small" value={trendDays} onChange={setTrendDays} options={[{ value: 7, label: '近7天' }, { value: 14, label: '近14天' }, { value: 30, label: '近30天' }]} /></Space>}>
            <Line {...(sessionsLine as any)} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="活跃学生数">
            <Line {...(activeLine as any)} />
          </Card>
        </Col>
      </Row>

      <Typography.Title level={3} style={{ marginTop: 24 }}>Top 榜</Typography.Title>
      <Row gutter={12}>
        <Col span={12}>
          <Card title={<Space><span>Top课程</span><Radio.Group size="small" value={topMetric} onChange={(e) => setTopMetric(e.target.value)}><Radio.Button value="sessions">按人次</Radio.Button><Radio.Button value="submissions">按提交次数</Radio.Button></Radio.Group></Space>}>
            <Column {...(topBarConfig as any)} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Top学校">
            <Column {...({
              data: topSchoolsRows,
              xField: 'name',
              yField: 'sessions',
              theme: 'classicDark',
              xAxis: { ...commonAxis, label: { style: { fill: '#c7d2fe' } } },
              yAxis: { ...commonAxis, grid: null, label: { formatter: (v: any) => `${v}`, style: { fill: '#c7d2fe' } } },
              seriesField: undefined,
              legend: false,
              color: ['#22d3ee', '#34d399', '#60a5fa', '#a78bfa', '#f59e0b'],
              columnStyle: { radius: [4, 4, 0, 0] },
              meta: { sessions: { alias: '人次' } },
            } as any)} />
          </Card>
        </Col>
      </Row>

      <Typography.Title level={3} style={{ marginTop: 24 }}>课程明细</Typography.Title>
      <Select style={{ width: 320, marginBottom: 12 }} value={courseId} onChange={setCourseId} options={(courses || []).map((c: any) => ({ value: c._id, label: `${c.name}（${c.type}）` }))} />
      <Card>
        {courseDetail?.course?.type === 'modular' ? (
          <>
            <Row gutter={12}><Col span={8}><Statistic title="参与人数" value={courseDetail?.participants || 0} /></Col></Row>
            <Typography.Title level={5} style={{ marginTop: 12 }}>模块均分</Typography.Title>
            <Table size="small" rowKey={(r) => r._id} dataSource={courseDetail?.moduleAvg || []} pagination={false} columns={[
              { key: 'module', title: '模块', dataIndex: '_id' },
              { key: 'avgScore', title: '均分', dataIndex: 'avgScore', render: (v: number) => (v ? v.toFixed(1) : 0) },
              { key: 'submissions', title: '提交次数', dataIndex: 'submissions' },
            ] as any} />
            <Typography.Title level={5} style={{ marginTop: 12 }}>班级均分</Typography.Title>
            <Table size="small" rowKey={(r) => (r._id || `class-${r.count}-${Math.round((r.avgTotal || 0) * 10)}`)} dataSource={courseDetail?.classAgg || []} pagination={false} columns={[
              { key: 'className', title: '班级', dataIndex: '_id' },
              { key: 'avgTotal', title: '平均总分', dataIndex: 'avgTotal', render: (v: number) => (v ? v.toFixed(1) : 0) },
              { key: 'count', title: '人数', dataIndex: 'count' },
            ] as any} />
          </>
        ) : courseDetail ? (
          <>
            <Row gutter={12}><Col span={8}><Statistic title="参与人数" value={courseDetail?.participants || 0} /></Col><Col span={8}><Statistic title="学习人次" value={courseDetail?.totalSessions || 0} /></Col></Row>
            <Typography.Text type="secondary">提示：可扩展显示班级维度的总/平均时长（已返回 classAgg 数据）。</Typography.Text>
          </>
        ) : null}
      </Card>
    </div>
  );
} 