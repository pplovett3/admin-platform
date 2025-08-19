"use client";
import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, Select, message, Row, Col, Tabs } from 'antd';
import { apiDelete, apiGet, apiPost, apiPut } from '@/app/_utils/api';
import { getToken, parseJwt, Role } from '@/app/_utils/auth';

interface Payload { userId: string; role: Role; schoolId?: string; name?: string }

type UserTab = 'schoolAdmin' | 'teacher' | 'student';

export default function UsersPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<{ school?: string; className?: string; role?: string; q?: string }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form] = Form.useForm();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // role-aware context
  const [me, setMe] = useState<Payload | null>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role>('student');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<UserTab>('student');

  useEffect(() => {
    const payload = parseJwt(getToken());
    if (payload) {
      const payloadMe = { userId: payload.userId, role: payload.role, schoolId: payload.schoolId, name: (payload as any).name } as Payload;
      setMe(payloadMe);
      if (payloadMe.role === 'superadmin') setActiveTab('schoolAdmin');
      else if (payloadMe.role === 'schoolAdmin') setActiveTab('teacher');
      else setActiveTab('student');
    }
  }, []);

  // preload schools for superadmin so school names render in table immediately
  useEffect(() => {
    if (me?.role === 'superadmin') {
      loadSchools();
    }
  }, [me?.role]);

  useEffect(() => {
    setQuery((q) => ({ ...q, role: activeTab }));
  }, [activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(query as any).toString();
      const list = await apiGet<any[]>(`/api/users${params ? `?${params}` : ''}`);
      setData(Array.isArray(list) ? list : []);
    } catch (e: any) {
      message.error(e.message || '加载用户失败');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [JSON.stringify(query)]);

  const loadSchools = async () => {
    try {
      const list = await apiGet<any[]>(`/api/schools`);
      setSchools(list || []);
    } catch {}
  };

  const loadClassesForTeacher = async (teacherId?: string, schoolId?: string) => {
    try {
      const head = teacherId ? `headTeacher=${teacherId}` : '';
      const sch = schoolId ? `${head ? '&' : ''}schoolId=${schoolId}` : '';
      const qs = head || sch ? `?${head}${sch}` : '';
      const list = await apiGet<any[]>(`/api/classes${qs}`);
      setClasses(list || []);
      if (!editing && (list || []).length > 0) {
        form.setFieldsValue({ classId: list[0]._id, className: list[0].name });
      }
    } catch {}
  };

  const loadClassesForSchool = async (schoolId?: string) => {
    try {
      if (!schoolId) { setClasses([]); return; }
      const list = await apiGet<any[]>(`/api/classes?schoolId=${schoolId}`);
      setClasses(list || []);
    } catch {}
  };

  const schoolNameOf = (record: any) => {
    if ((schools || []).length === 0) return record.school || '';
    const found = (schools || []).find((s: any) => s._id === record.schoolId);
    return found?.name || record.school || '';
  };

  const columns = useMemo(() => {
    const baseOps = {
      title: '操作',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" onClick={() => onEdit(record)}>编辑</Button>
          <Button size="small" danger onClick={() => onDelete(record._id)}>删除</Button>
        </Space>
      ),
    };
    if (activeTab === 'schoolAdmin') {
      return [
        { title: '姓名', dataIndex: 'name' },
        { title: '手机号', dataIndex: 'phone' },
        { title: '学校', dataIndex: 'school', render: (_: any, r: any) => schoolNameOf(r) },
        baseOps,
      ];
    }
    if (activeTab === 'teacher') {
      return [
        { title: '姓名', dataIndex: 'name' },
        { title: '手机号', dataIndex: 'phone' },
        { title: '学校', dataIndex: 'school', render: (_: any, r: any) => schoolNameOf(r) },
        { title: '班级', dataIndex: 'className' },
        baseOps,
      ];
    }
    return [
      { title: '姓名', dataIndex: 'name' },
      { title: '手机号', dataIndex: 'phone' },
      { title: '学校', dataIndex: 'school', render: (_: any, r: any) => schoolNameOf(r) },
      { title: '班级', dataIndex: 'className' },
      { title: '学号', dataIndex: 'studentId' },
      baseOps,
    ];
  }, [activeTab, schools]);

  const onCreate = async () => {
    setEditing(null);
    form.resetFields();
    setSelectedRole(activeTab as Role);
    if (me?.role === 'teacher') {
      setSelectedSchoolId(me.schoolId);
      await loadClassesForTeacher(me.userId, me.schoolId);
      form.setFieldsValue({ schoolId: me.schoolId });
    } else if (me?.role === 'schoolAdmin') {
      setSelectedSchoolId(me.schoolId);
      await loadClassesForSchool(me.schoolId);
      form.setFieldsValue({ schoolId: me.schoolId });
    } else {
      setSelectedSchoolId(undefined);
      await loadSchools();
      setClasses([]);
    }
    setModalOpen(true);
  };

  const onEdit = async (record: any) => {
    setEditing(record);
    setSelectedRole(record.role);
    setSelectedSchoolId(record.schoolId);
    form.setFieldsValue({
      name: record.name,
      phone: record.phone,
      schoolId: record.schoolId,
      role: record.role,
      className: record.className,
      studentId: record.studentId,
    });
    if (me?.role === 'teacher') await loadClassesForTeacher(me.userId, me.schoolId);
    else if (me?.role === 'schoolAdmin') await loadClassesForSchool(me.schoolId);
    else if (me?.role === 'superadmin') {
      await loadSchools();
      if (record.schoolId) await loadClassesForSchool(record.schoolId);
    }
    setModalOpen(true);
  };

  useEffect(() => {
    if (modalOpen && editing) {
      form.setFieldsValue({
        name: editing.name,
        phone: editing.phone,
        schoolId: editing.schoolId,
        role: editing.role,
        className: editing.className,
        studentId: editing.studentId,
      });
    }
  }, [modalOpen, editing, form]);

  const onDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除该用户？',
      onOk: async () => {
        try {
          await apiDelete(`/api/users/${id}`);
          message.success('删除成功');
          fetchUsers();
        } catch (e: any) {
          message.error(e.message || '删除失败');
        }
      },
    });
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    const isEdit = !!editing;
    const url = isEdit ? `/api/users/${editing._id}` : `/api/users`;

    const body: any = { ...values };
    if (me?.role === 'teacher') {
      body.role = 'student';
      body.schoolId = me.schoolId;
      if (body.classId) {
        const cls = classes.find((c) => c._id === body.classId);
        if (cls) body.className = cls.name;
        delete body.classId;
      }
    } else if (me?.role === 'schoolAdmin') {
      body.schoolId = me.schoolId;
      body.role = activeTab;
      if (activeTab === 'student' && body.classId) {
        const cls = classes.find((c) => c._id === body.classId);
        if (cls) body.className = cls.name;
        delete body.classId;
      }
    } else if (me?.role === 'superadmin') {
      if (selectedSchoolId) body.schoolId = selectedSchoolId;
      body.role = activeTab;
      if (body.classId) {
        const cls = classes.find((c) => c._id === body.classId);
        if (cls) body.className = cls.name;
        delete body.classId;
      }
    }

    try {
      if (isEdit) await apiPut(url, body);
      else await apiPost(url, body);
      message.success('保存成功');
      setModalOpen(false);
      fetchUsers();
    } catch (e: any) {
      message.error(e.message || '保存失败');
    }
  };

  const isTeacher = me?.role === 'teacher';
  const isSchoolAdmin = me?.role === 'schoolAdmin';
  const isSuperadmin = me?.role === 'superadmin';

  const showSchoolSelect = isSuperadmin;
  const showClassDropdown = (activeTab === 'student') || (activeTab === 'teacher');
  const classRequired = activeTab === 'student';

  const availableTabs: { key: UserTab; label: string }[] = useMemo(() => {
    if (isSuperadmin) return [
      { key: 'schoolAdmin', label: '校级管理员' },
      { key: 'teacher', label: '教师' },
      { key: 'student', label: '学生' },
    ];
    if (isSchoolAdmin) return [
      { key: 'teacher', label: '教师' },
      { key: 'student', label: '学生' },
    ];
    return [ { key: 'student', label: '学生' } ];
  }, [isSuperadmin, isSchoolAdmin]);

  if (!mounted) return null;

  const initialValues = editing ? {
    name: editing.name,
    phone: editing.phone,
    schoolId: editing.schoolId,
    className: editing.className,
    studentId: editing.studentId,
  } : undefined;

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as UserTab)}
        items={availableTabs.map(t => ({ key: t.key, label: t.label }))}
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="搜索姓名/手机号/学号" allowClear onChange={(e) => setQuery((q) => ({ ...q, q: e.target.value }))} />
        <Input placeholder="学校" allowClear onChange={(e) => setQuery((q) => ({ ...q, school: e.target.value }))} />
        <Input placeholder="班级" allowClear onChange={(e) => setQuery((q) => ({ ...q, className: e.target.value }))} />
        <Button type="primary" onClick={onCreate}>新增用户</Button>
      </Space>

      <Table rowKey="_id" loading={loading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal open={modalOpen} title={editing ? '编辑用户' : '新增用户'} onCancel={() => setModalOpen(false)} onOk={onSubmit} destroyOnClose getContainer={false}>
        <Form form={form} layout="vertical" preserve={false} initialValues={initialValues}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="手机号" rules={[{ required: true }]}><Input /></Form.Item></Col>

            {showSchoolSelect && (
              <Col span={12}>
                <Form.Item name="schoolId" label="学校" rules={[{ required: true }]}> 
                  <Select
                    options={(schools || []).map((s) => ({ value: s._id, label: s.name }))}
                    onChange={async (v) => { setSelectedSchoolId(v); await loadClassesForSchool(v); form.setFieldsValue({ schoolId: v }); }}
                  />
                </Form.Item>
              </Col>
            )}

            {showClassDropdown && (
              <Col span={12}>
                <Form.Item name="classId" label="班级" rules={[{ required: classRequired }]}> 
                  <Select showSearch optionFilterProp="label" options={(classes || []).map((c) => ({ value: c._id, label: c.name }))} />
                </Form.Item>
              </Col>
            )}

            {activeTab !== 'schoolAdmin' && (
              <>
                <Col span={12}><Form.Item name="className" label="班级（手动输入，可留空，若上面选择则自动填写）"><Input /></Form.Item></Col>
                {activeTab === 'student' && <Col span={12}><Form.Item name="studentId" label="学号" rules={[{ required: true }]}><Input /></Form.Item></Col>}
              </>
            )}

            <Col span={24}><Form.Item name="password" label={editing ? '新密码（不修改可留空）' : '密码'} rules={editing ? [] : [{ required: true }]}>
              <Input.Password placeholder={editing ? '不修改请留空' : '默认可用 111111'} />
            </Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
} 