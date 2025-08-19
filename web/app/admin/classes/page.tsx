"use client";
import { useEffect, useState } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, Select, App } from 'antd';
import { apiDelete, apiGet, apiPost, apiPut } from '@/app/_utils/api';
import { getToken, parseJwt, Role } from '@/app/_utils/auth';

export default function ClassesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const me = (() => {
    const payload = parseJwt(getToken());
    return payload ? { role: payload.role as Role, schoolId: payload.schoolId as string | undefined } : { role: undefined, schoolId: undefined };
  })();

  const isSuperadmin = me.role === 'superadmin';

  const loadTeachersForSchool = async (schoolId?: string) => {
    try {
      let url = '/api/users?role=teacher';
      if (isSuperadmin && schoolId) url += `&schoolId=${schoolId}`;
      if (!isSuperadmin && me.schoolId) url += `&schoolId=${me.schoolId}`;
      const t = await apiGet<any[]>(url);
      setTeachers(Array.isArray(t) ? t : []);
    } catch {}
  };

  const load = async (params?: any) => {
    setLoading(true);
    try {
      const qs = isSuperadmin ? '' : (me.schoolId ? `?schoolId=${me.schoolId}` : '');
      const list = await apiGet<any[]>(`/api/classes${qs}`);
      setData(Array.isArray(list) ? list : []);
      if (isSuperadmin) {
        const sch = await apiGet<any[]>(`/api/schools`);
        setSchools(Array.isArray(sch) ? sch : []);
        setTeachers([]);
      } else {
        await loadTeachersForSchool(me.schoolId);
      }
    } catch (e: any) { message.error(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const cols = [
    { title: '班级名称', dataIndex: 'name' },
    { title: '学校', dataIndex: 'schoolId', render: (_: any, r: any) => r.schoolId?.name || '-' },
    { title: '班主任', dataIndex: ['headTeacher','name'], render: (_: any, r: any) => r.headTeacher?.name || '-' },
    {
      title: '操作',
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" onClick={async () => { setEditing(r); const sid = (r as any).schoolId?._id || (r as any).schoolId; setSelectedSchoolId(sid); await loadTeachersForSchool(sid); setOpen(true); }}>编辑</Button>
          <Button size="small" danger onClick={() => onDelete(r._id)}>删除</Button>
        </Space>
      ),
    },
  ];

  const onCreate = async () => {
    setEditing(null);
    form.resetFields();
    setSelectedSchoolId(undefined);
    if (!isSuperadmin) {
      setSelectedSchoolId(me.schoolId);
      await loadTeachersForSchool(me.schoolId);
    } else {
      setTeachers([]);
    }
    setOpen(true);
  };
  
  const onDelete = (id: string) => {
    Modal.confirm({ title: '删除该班级？', onOk: async () => { await apiDelete(`/api/classes/${id}`); message.success('已删除'); load(); } });
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    if (!isSuperadmin && me.schoolId) {
      values.schoolId = me.schoolId;
    }
    if (editing) { await apiPut(`/api/classes/${editing._id}`, values); message.success('已更新'); }
    else { await apiPost('/api/classes', values); message.success('已创建'); }
    setOpen(false); setEditing(null); load();
  };

  if (!mounted) return null;

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>班级管理</Typography.Title>
        <Button type="primary" onClick={onCreate}>新增班级</Button>
      </Space>
      <Table rowKey="_id" columns={cols as any} dataSource={data || []} loading={loading} />

      <Modal title={editing ? '编辑班级' : '新增班级'} open={open} onCancel={() => setOpen(false)} onOk={onSubmit} destroyOnHidden getContainer={false}
        afterOpenChange={(visible) => {
          if (visible) {
            if (editing) {
              const sid = editing.schoolId?._id || editing.schoolId;
              form.setFieldsValue({ name: editing.name, headTeacher: editing.headTeacher?._id, schoolId: sid });
            } else if (!isSuperadmin && me.schoolId) {
              form.setFieldsValue({ schoolId: me.schoolId });
            }
          }
        }}
      >
        <Form layout="vertical" form={form} preserve={false}>
          {isSuperadmin && (
            <Form.Item name="schoolId" label="所属学校" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={(schools || []).map(s => ({ value: s._id, label: s.name }))} onChange={async (v) => { setSelectedSchoolId(v); await loadTeachersForSchool(v); }} />
            </Form.Item>
          )}
          <Form.Item name="name" label="班级名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="headTeacher" label="班主任">
            <Select allowClear showSearch optionFilterProp="label" options={(teachers || []).map(t => ({ value: t._id, label: `${t.name}${t.phone ? `(${t.phone})` : ''}` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
} 