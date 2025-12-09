"use client";
import { useEffect, useState, useMemo } from 'react';
import { Card, Typography, Select, Table, Space, Input, App, Alert, Modal, Button, Tabs, Tag, Statistic, Row, Col, Progress, Empty } from 'antd';
import { TrophyOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { apiGet, authFetch } from '@/app/_utils/api';
import { getToken, parseJwt, Role } from '@/app/_utils/auth';

export default function ScoresPage() {
  const { message } = App.useApp();
  const [mounted, setMounted] = useState(false);
  const [me, setMe] = useState<{ userId: string; role: Role; className?: string; schoolId?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('traditional');

  // AI课程答题记录
  const [aiQuizRecords, setAiQuizRecords] = useState<any[]>([]);
  const [aiQuizLoading, setAiQuizLoading] = useState(false);

  const [courses, setCourses] = useState<any[]>([]);
  const [courseId, setCourseId] = useState<string>('');
  const [courseType, setCourseType] = useState<'simple' | 'modular' | ''>('');

  const [classFilter, setClassFilter] = useState<string>('');
  const [moduleScores, setModuleScores] = useState<any[]>([]);
  const [classSummary, setClassSummary] = useState<any[]>([]);
  const [timeLog, setTimeLog] = useState<{ totalDurationSec: number; logs: any[] } | null>(null);
  const [authorized, setAuthorized] = useState<boolean>(true);

  // superadmin scope
  const isSuperadmin = me?.role === 'superadmin';
  const [schools, setSchools] = useState<any[]>([]);
  const [schoolIdFilter, setSchoolIdFilter] = useState<string>('');
  const [classes, setClasses] = useState<any[]>([]);
  const [classIdFilter, setClassIdFilter] = useState<string>('');
  const [searchTick, setSearchTick] = useState(0);

  // history submissions
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [detailSubmissions, setDetailSubmissions] = useState<any[]>([]);

  // modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<any>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const token = getToken();
    const payload = parseJwt(token);
    if (payload) setMe({ userId: payload.userId, role: payload.role, className: (payload as any).className, schoolId: (payload as any).schoolId });
  }, []);

  // 加载AI课程答题记录
  const loadAiQuizRecords = async () => {
    setAiQuizLoading(true);
    try {
      const res = await authFetch<any>('/api/quiz/records');
      setAiQuizRecords(res.records || []);
    } catch (e: any) {
      console.error('加载AI课程答题记录失败:', e);
      setAiQuizRecords([]);
    } finally {
      setAiQuizLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai-quiz' && me?.userId) {
      loadAiQuizRecords();
    }
  }, [activeTab, me?.userId]);

  const loadCourses = async () => {
    try {
      const list = await apiGet<any[]>('/api/courses');
      const data = Array.isArray(list) ? list : [];
      setCourses(data);
      if (!courseId && data.length > 0) {
        setCourseId(data[0]._id);
        setCourseType(data[0].type);
      }
    } catch (e: any) { message.error(e.message || '加载课程失败'); }
  };
  useEffect(() => { loadCourses(); }, []);

  // superadmin load schools and classes
  useEffect(() => {
    const run = async () => {
      if (!isSuperadmin) return;
      try {
        const ss = await apiGet<any[]>('/api/schools');
        setSchools(Array.isArray(ss) ? ss : []);
      } catch {}
    };
    run();
  }, [isSuperadmin]);

  useEffect(() => {
    const run = async () => {
      if (!isSuperadmin || !schoolIdFilter) { setClasses([]); return; }
      try {
        const cs = await apiGet<any[]>(`/api/classes?schoolId=${schoolIdFilter}`);
        setClasses(Array.isArray(cs) ? cs : []);
      } catch { setClasses([]); }
    };
    run();
  }, [isSuperadmin, schoolIdFilter]);

  const checkAuthorization = async (schoolId?: string, cId?: string) => {
    try {
      if (!schoolId || !cId) { setAuthorized(true); return; }
      const res = await apiGet<any>(`/api/enrollments/schools/check?schoolId=${schoolId}&courseId=${cId}`);
      setAuthorized(!!res?.allowed);
    } catch { setAuthorized(true); }
  };

  // whenever course changes, update type and authorization
  useEffect(() => {
    const c = (courses || []).find((x) => x._id === courseId);
    setCourseType((c?.type as any) || '');
    checkAuthorization(me?.schoolId, courseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, courses, me?.schoolId]);

  const loadStudentData = async () => {
    if (!me?.userId || !courseId) return;
    if (courseType === 'modular') {
      try {
        const doc = await apiGet<any>(`/api/scores/user/${me.userId}?courseId=${courseId}`);
        setModuleScores(Array.isArray(doc?.moduleScores) ? doc.moduleScores : []);
        // load history
        const hist = await apiGet<any>(`/api/scores/user/${me.userId}/submissions?courseId=${courseId}`);
        const rows = Array.isArray(hist?.rows) ? hist.rows : [];
        setMySubmissions(rows);
        setTimeLog(null);
      } catch (e: any) { message.error(e.message || '加载成绩失败'); setModuleScores([]); setMySubmissions([]); }
    } else if (courseType === 'simple') {
      try {
        const t = await apiGet<any>(`/api/timelog/user/${me.userId}?courseId=${courseId}`);
        setTimeLog({ totalDurationSec: t.totalDurationSec || 0, logs: Array.isArray(t.logs) ? t.logs : [] });
        setModuleScores([]);
        setMySubmissions([]);
      } catch (e: any) { message.error(e.message || '加载时长失败'); setTimeLog({ totalDurationSec: 0, logs: [] }); setMySubmissions([]); }
    }
  };

  const loadClassData = async () => {
    const cls = isSuperadmin ? (classes.find(c => c._id === classIdFilter)?.name || '') : (me?.className || '');
    const schoolIdToUse = isSuperadmin ? (schoolIdFilter || me?.schoolId || '') : me?.schoolId || '';
    if (!cls || !courseId) return;
    if (courseType === 'modular') {
      try {
        const list = await apiGet<any[]>(`/api/scores/class/${encodeURIComponent(cls)}?courseId=${courseId}${schoolIdToUse ? `&schoolId=${schoolIdToUse}` : ''}`);
        setClassSummary(Array.isArray(list) ? list : []);
        setTimeLog(null);
      } catch (e: any) { message.error(e.message || '加载班级成绩失败'); setClassSummary([]); }
    } else if (courseType === 'simple') {
      try {
        const resp = await apiGet<any>(`/api/timelog/class/${encodeURIComponent(cls)}?courseId=${courseId}`);
        const rows = Array.isArray(resp?.rows) ? resp.rows : [];
        setClassSummary(rows);
        setTimeLog(null);
      } catch (e: any) { message.error(e.message || '加载班级时长失败'); setClassSummary([]); }
    }
  };

  useEffect(() => {
    if (!courseId || !me) return;
    if (me.role === 'student') loadStudentData();
    else if (searchTick > 0) loadClassData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role, me?.userId, courseId, searchTick, courseType]);

  const humanDuration = (sec: number) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`;
  };

  const openDetail = (record: any) => {
    setDetailUser(record);
    setDetailOpen(true);
    // fetch submissions for this user
    if (record?.userId && courseId) {
      apiGet<any>(`/api/scores/user/${record.userId}/submissions?courseId=${courseId}`)
        .then((resp) => setDetailSubmissions(Array.isArray(resp?.rows) ? resp.rows : []))
        .catch(() => setDetailSubmissions([]));
    } else {
      setDetailSubmissions([]);
    }
  };

  const toAbsoluteHttpUrl = (url?: string): string | null => {
    if (!url) return null;
    const u = String(url).trim();
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    // 如果用户只填了域名或路径，默认补 https://
    return `https://${u}`;
  };

  if (!mounted) return null;

  const canSearch = isSuperadmin ? Boolean(courseId && schoolIdFilter && classIdFilter) : Boolean(courseId);

  // AI课程答题统计
  const aiQuizStats = {
    totalAttempts: aiQuizRecords.length,
    avgScore: aiQuizRecords.length > 0 
      ? Math.round(aiQuizRecords.reduce((sum, r) => sum + (r.score || 0), 0) / aiQuizRecords.length) 
      : 0,
    bestScore: aiQuizRecords.length > 0 
      ? Math.max(...aiQuizRecords.map(r => r.score || 0)) 
      : 0,
    passCount: aiQuizRecords.filter(r => (r.score || 0) >= 60).length
  };

  // AI课程答题记录列定义
  const aiQuizColumns = [
    {
      title: '课程名称',
      dataIndex: 'courseTitle',
      key: 'courseTitle',
      ellipsis: true,
      render: (text: string) => text || '未知课程'
    },
    {
      title: '得分',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      align: 'center' as const,
      render: (score: number) => (
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
      align: 'center' as const,
      render: (_: any, record: any) => (
        <span>
          <span style={{ color: '#52c41a' }}>{record.correctCount}</span>
          <span style={{ color: '#999' }}> / {record.totalQuestions}</span>
        </span>
      )
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        record.score >= 60 
          ? <Tag color="success">及格</Tag>
          : <Tag color="error">不及格</Tag>
      )
    },
    {
      title: '答题时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'traditional',
            label: (
              <span>
                <ClockCircleOutlined style={{ marginRight: 8 }} />
                传统课程成绩
              </span>
            ),
            children: (
              <>
                <Space style={{ marginBottom: 16 }} wrap>
        <Select
          value={courseId}
          style={{ width: 300 }}
          placeholder="选择课程"
          onChange={setCourseId}
          options={(courses || []).map((c) => ({ value: c._id, label: `${c.name}（${c.type}）` }))}
        />
        {isSuperadmin && (
          <>
            <Select
              allowClear
              placeholder="选择学校（超管）"
              style={{ width: 240 }}
              value={schoolIdFilter || undefined}
              onChange={(v) => { setSchoolIdFilter(v || ''); setClassIdFilter(''); }}
              options={(schools || []).map(s => ({ value: s._id, label: s.name }))}
            />
            <Select
              allowClear
              placeholder="选择班级（超管）"
              style={{ width: 240 }}
              value={classIdFilter || undefined}
              onChange={(v) => setClassIdFilter(v || '')}
              options={(classes || []).map(c => ({ value: c._id, label: c.name }))}
            />
          </>
        )}
        {me?.role !== 'student' && (
          <Button type="primary" onClick={() => setSearchTick((t) => t + 1)} disabled={!canSearch}>查询</Button>
        )}
      </Space>

      {!authorized && (
        <Alert type="warning" showIcon message="当前学校未授权该课程，无法查看成绩/时长" style={{ marginBottom: 12 }} />
      )}

      {me?.role === 'student' ? (
        courseType === 'modular' ? (
          <>
            <Card title="我的最高成绩" style={{ marginBottom: 16 }}>
              <Table
                rowKey={(r: any) => r.moduleId}
                dataSource={moduleScores || []}
                pagination={false}
                columns={[
                  { title: '模块ID', dataIndex: 'moduleId' },
                  { title: '模块名称', dataIndex: 'moduleName', render: (v, r) => v || r.moduleId },
                  { title: '分数', dataIndex: 'score', render: (v) => (v == null ? '暂无该模块分数' : v) },
                  { title: '满分', dataIndex: 'maxScore' },
                  { title: '尝试次数', dataIndex: 'attempts' },
                  { title: '完成时间', dataIndex: 'completedAt', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
                ]}
              />
            </Card>
            <Card title="成绩记录">
              <Table
                rowKey={(r: any) => r._id || `${r.submittedAt}-${Math.random()}`}
                dataSource={mySubmissions || []}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: '提交时间', dataIndex: 'submittedAt', render: (v: any) => new Date(v).toLocaleString() },
                  { title: '模块ID', render: (_: any, r: any) => (Array.isArray(r.moduleScores) && r.moduleScores[0]?.moduleId) || '-' },
                  { title: '模块名称', render: (_: any, r: any) => (Array.isArray(r.moduleScores) && r.moduleScores[0]?.moduleName) || (Array.isArray(r.moduleScores) && r.moduleScores[0]?.moduleId) || '-' },
                  { title: '分数', render: (_: any, r: any) => (Array.isArray(r.moduleScores) && r.moduleScores[0]?.score) ?? '-' },
                  { title: '满分', render: (_: any, r: any) => (Array.isArray(r.moduleScores) && r.moduleScores[0]?.maxScore) ?? '-' },
                  { title: '查看详情', render: (_: any, r: any) => {
                    const raw = Array.isArray(r.moduleScores) && r.moduleScores[0]?.moreDetail;
                    const url = toAbsoluteHttpUrl(raw || '');
                    return <Button type="link" disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer,width=1200,height=800,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes')}>查看详情</Button>;
                  } },
                ]}
              />
            </Card>
          </>
        ) : (
          <Card title="我的学习时长">
            <Typography.Paragraph>总时长：{humanDuration(timeLog?.totalDurationSec || 0)}</Typography.Paragraph>
            <Table rowKey={(r) => r._id} dataSource={timeLog?.logs || []} pagination={{ pageSize: 10 }} columns={[
              { title: '开始', dataIndex: 'startedAt', render: (v) => new Date(v).toLocaleString() },
              { title: '结束', dataIndex: 'endedAt', render: (v) => new Date(v).toLocaleString() },
              { title: '时长(秒)', dataIndex: 'durationSec' },
            ]} />
          </Card>
        )
      ) : (
        courseType === 'modular' ? (
          <Card title="班级成绩汇总">
            <Table
              rowKey={(r) => r.userId}
              dataSource={classSummary || []}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '姓名', dataIndex: 'name' },
                { title: '学号', dataIndex: 'studentId' },
                { title: '总分', dataIndex: 'total' },
                { title: '满分', dataIndex: 'maxTotal' },
                { title: '提交时间', dataIndex: 'lastSubmittedAt', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
                { title: '详情', render: (_, r) => <a onClick={() => openDetail(r)}>查看模块详情</a> },
              ]}
            />

            <Modal
              title={`模块详情 - ${detailUser?.name || ''}`}
              open={detailOpen}
              onCancel={() => setDetailOpen(false)}
              footer={null}
              destroyOnHidden
              getContainer={false}
            >
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>成绩记录</Typography.Paragraph>
              <Table
                size="small"
                rowKey={(r: any) => r._id || `${r.submittedAt}-${Math.random()}`}
                dataSource={detailSubmissions || []}
                pagination={{ pageSize: 5 }}
                columns={[
                  { title: '提交时间', dataIndex: 'submittedAt', render: (v: any) => new Date(v).toLocaleString() },
                  { title: '模块ID', render: (_: any, r: any) => (Array.isArray(r.moduleScores) && r.moduleScores[0]?.moduleId) || '-' },
                  { title: '模块名称', render: (_: any, r: any) => (Array.isArray(r.moduleScores) && r.moduleScores[0]?.moduleName) || (Array.isArray(r.moduleScores) && r.moduleScores[0]?.moduleId) || '-' },
                  { title: '分数', render: (_: any, r: any) => (Array.isArray(r.moduleScores) && r.moduleScores[0]?.score) ?? '-' },
                  { title: '满分', render: (_: any, r: any) => (Array.isArray(r.moduleScores) && r.moduleScores[0]?.maxScore) ?? '-' },
                  { title: '查看详情', render: (_: any, r: any) => {
                    const raw = Array.isArray(r.moduleScores) && r.moduleScores[0]?.moreDetail;
                    const url = toAbsoluteHttpUrl(raw || '');
                    return <Button type="link" disabled={!url} onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer,width=1200,height=800,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes')}>查看详情</Button>;
                  } },
                ]}
              />

              <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 8 }}>当前模块分数</Typography.Paragraph>
              <Table
                size="small"
                rowKey={(r: any) => r.moduleId}
                dataSource={detailUser?.moduleScores || []}
                pagination={false}
                columns={[
                  { title: '模块ID', dataIndex: 'moduleId' },
                  { title: '模块名称', dataIndex: 'moduleName', render: (v, r) => v || r.moduleId },
                  { title: '分数', dataIndex: 'score' },
                  { title: '满分', dataIndex: 'maxScore' },
                  { title: '尝试次数', dataIndex: 'attempts' },
                  { title: '完成时间', dataIndex: 'completedAt', render: (v) => (v ? new Date(v).toLocaleString() : '-') },
                ]}
              />
            </Modal>
          </Card>
        ) : (
          <Card title="班级时长汇总">
            <Table
              rowKey={(r) => r.userId}
              dataSource={classSummary || []}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: '姓名', dataIndex: 'name' },
                { title: '学号', dataIndex: 'studentId' },
                { title: '总时长', dataIndex: 'totalDurationSec', render: (v) => humanDuration(v || 0) },
                { title: '学习人次', dataIndex: 'sessions' },
              ]}
            />
          </Card>
        )
      )}
              </>
            )
          },
          {
            key: 'ai-quiz',
            label: (
              <span>
                <TrophyOutlined style={{ marginRight: 8 }} />
                AI课程答题成绩
              </span>
            ),
            children: (
              <div>
                {/* 统计卡片 */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="答题次数" 
                        value={aiQuizStats.totalAttempts} 
                        suffix="次"
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="平均分" 
                        value={aiQuizStats.avgScore}
                        suffix="分"
                        valueStyle={{ color: aiQuizStats.avgScore >= 60 ? '#52c41a' : '#ff4d4f' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="最高分" 
                        value={aiQuizStats.bestScore}
                        suffix="分"
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic 
                        title="及格率" 
                        value={aiQuizStats.totalAttempts > 0 ? Math.round((aiQuizStats.passCount / aiQuizStats.totalAttempts) * 100) : 0}
                        suffix="%"
                        valueStyle={{ color: aiQuizStats.passCount > 0 ? '#52c41a' : '#999' }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* 答题记录列表 */}
                <Card title="我的答题记录">
                  {aiQuizRecords.length > 0 ? (
                    <Table
                      columns={aiQuizColumns}
                      dataSource={aiQuizRecords}
                      rowKey={(r) => `${r.courseId}-${r.completedAt}`}
                      loading={aiQuizLoading}
                      pagination={{ pageSize: 10 }}
                    />
                  ) : (
                    <Empty 
                      description={aiQuizLoading ? "加载中..." : "暂无答题记录"} 
                      style={{ padding: '40px 0' }}
                    />
                  )}
                </Card>
              </div>
            )
          }
        ]}
      />
    </div>
  );
} 