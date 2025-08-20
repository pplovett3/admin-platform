"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, message, Select, Space, Switch, Table, Tag } from "antd";
import { authFetch } from "../../_lib/api";
import { getCurrentRole } from "../../_lib/api";

interface UserRow { id: string; name: string; phone?: string; role: string; className?: string; metaverseAllowed?: boolean }

export default function MetaverseAuthorizePage() {
  const role = getCurrentRole();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string|undefined>();

  async function refresh() {
    if (role !== 'superadmin') return;
    try {
      setLoading(true);
      const qs = new URLSearchParams({ q, role: roleFilter||"" }).toString();
      const data = await authFetch<UserRow[]>(`/api/users?${qs}`);
      // map shape if needed
      const mapped = (data as any[]).map((u: any) => ({
        id: u._id || u.id,
        name: u.name,
        phone: u.phone,
        role: u.role,
        className: u.className,
        metaverseAllowed: u.metaverseAllowed,
      }));
      setRows(mapped);
    } catch(e:any){ message.error(e?.message||'加载失败'); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ refresh(); }, [roleFilter]);

  async function toggle(id: string, allowed: boolean) {
    try {
      await authFetch(`/api/users/${id}/metaverse-allow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed })
      });
      message.success('已更新');
      setRows(prev => prev.map(r => r.id===id? { ...r, metaverseAllowed: allowed }: r));
    } catch(e:any){ message.error(e?.message||'更新失败'); }
  }

  if (role !== 'superadmin') {
    return <Card><Tag color="red">仅超管可访问此页</Tag></Card>;
  }

  return (
    <Card title="元宇宙大厅授权">
      <Space style={{ marginBottom: 12 }}>
        <Select placeholder="角色" allowClear style={{ width: 160 }} onChange={setRoleFilter}
          options={[
            { value: 'schoolAdmin', label: '学校管理员' },
            { value: 'teacher', label: '教师' },
            { value: 'student', label: '学生' },
            { value: 'superadmin', label: '超管' },
          ]}
        />
        <Input.Search placeholder="搜索姓名/手机" allowClear style={{ width: 220 }} value={q}
          onChange={e=>setQ(e.target.value)} onSearch={()=>refresh()} />
        <Button onClick={refresh}>刷新</Button>
      </Space>
      <Table rowKey="id" loading={loading} dataSource={rows} pagination={false}
        columns={[
          { title: '姓名', dataIndex: 'name' },
          { title: '手机', dataIndex: 'phone' },
          { title: '角色', dataIndex: 'role' },
          { title: '班级', dataIndex: 'className' },
          { title: '授权', dataIndex: 'metaverseAllowed', render: (v:boolean, r:UserRow)=>
            <Switch checked={!!v} onChange={(checked)=>toggle(r.id, checked)} /> },
        ]}
      />
    </Card>
  );
} 