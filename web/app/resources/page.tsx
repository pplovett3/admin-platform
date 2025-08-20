"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Divider, Flex, Input, message, Popconfirm, Select, Space, Table, Tabs, Upload, Switch, Tag } from "antd";
import type { UploadProps } from "antd";
import { EyeOutlined, DownloadOutlined, DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { authDownload, authFetch } from "../_lib/api";
import { API_URL, getCurrentRole } from "../_lib/api";

interface FileRow { id: string; type: string; originalName: string; size: number; createdAt: string; downloadUrl: string; viewUrl?: string; visibility?: string; storageRelPath?: string }

function humanSize(n: number): string {
  if (n < 1024) return `${n}B`;
  const units = ["KB","MB","GB","TB"]; let x = n/1024; let i=0; while (x>=1024 && i<units.length-1){x/=1024;i++;} return `${x.toFixed(1)}${units[i]}`;
}

export default function ResourcesPage() {
  const [active, setActive] = useState<string>("mine");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [type, setType] = useState<string|undefined>();
  const [q, setQ] = useState<string>("");
  const [isPublicUpload, setIsPublicUpload] = useState(false);
  const role = getCurrentRole();

  const columns = useMemo(() => [
    { title: "名称", dataIndex: "originalName" },
    { title: "类型", dataIndex: "type" },
    { title: "大小", dataIndex: "size", render: (v:number)=>humanSize(v) },
    { title: "上传时间", dataIndex: "createdAt", render: (v:string)=>new Date(v).toLocaleString() },
    { title: "操作", key: "op", render: (_:any, r:FileRow)=> <Space>
      {r.viewUrl && <Button icon={<EyeOutlined/>} onClick={()=> window.open(r.viewUrl!, '_blank')}>查看</Button>}
      <Button icon={<DownloadOutlined/>} onClick={()=>authDownload(r.downloadUrl, r.originalName)}>下载</Button>
      <Popconfirm title="确定删除该文件吗？" onConfirm={()=>onDelete(r)}>
        <Button danger icon={<DeleteOutlined/>}>删除</Button>
      </Popconfirm>
    </Space> },
  ],[]);

  async function onDelete(r: FileRow) {
    try {
      await authFetch(`/api/files/${r.id}`, { method: 'DELETE' });
      message.success('已删除');
      refresh();
    } catch(e:any){ message.error(e?.message||'删除失败'); }
  }

  async function refresh() {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ type: type||"", q }).toString();
      if (active === "mine") {
        const resp = await authFetch<{ rows: FileRow[] }>(`/api/files/mine?${qs}`);
        setRows(resp.rows);
      } else {
        const resp = await authFetch<{ rows: FileRow[] }>(`/api/files/public?${qs}`);
        setRows(resp.rows);
      }
    } catch (e:any) {
      message.error(e?.message||"加载失败");
    } finally { setLoading(false); }
  }

  useEffect(()=>{ refresh(); }, [active, type]);

  const uploadProps: UploadProps = {
    name: "file",
    multiple: false,
    showUploadList: true,
    action: undefined,
    customRequest: async (options) => {
      const { file, onError, onSuccess, onProgress } = options as any;
      try {
        const fd = new FormData();
        fd.append("file", file as any);
        if (role === 'superadmin' && isPublicUpload) fd.append('visibility','public');
        const token = (typeof localStorage !== 'undefined' && (localStorage.getItem('token')||localStorage.getItem('authToken'))) || '';
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/api/files/upload`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (evt) => {
          if (evt.total) {
            onProgress?.({ percent: Math.round((evt.loaded/evt.total)*100) });
          }
        };
        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onSuccess?.(JSON.parse(xhr.responseText));
            message.success('上传成功');
            refresh();
          } else {
            try { const j = JSON.parse(xhr.responseText||'{}'); message.error(j.message||'上传失败'); } catch { message.error('上传失败'); }
            onError?.(new Error('upload failed'));
          }
        };
        xhr.onerror = () => { message.error('上传失败'); onError?.(new Error('xhr error')); };
        xhr.send(fd);
      } catch (e:any) {
        message.error(e?.message||"上传失败");
        onError && onError(e);
      }
    }
  };

  return (
    <Card title="资源管理" extra={<Space>
      <Select placeholder="类型" allowClear style={{ width: 140 }} onChange={setType}
        options={[{value:'video',label:'视频'},{value:'image',label:'图片'},{value:'pdf',label:'PDF'},{value:'ppt',label:'PPT'},{value:'word',label:'Word'}]} />
      <Input.Search placeholder="搜索文件名" allowClear onSearch={()=>refresh()} onChange={(e)=>setQ(e.target.value)} style={{width:240}} />
      {role==='superadmin' && <Space size={6}><Tag>公开资源</Tag><Switch checked={isPublicUpload} onChange={setIsPublicUpload} /></Space>}
      <Upload {...uploadProps}><Button type="primary" icon={<UploadOutlined/>}>上传文件</Button></Upload>
    </Space>}>
      <Tabs activeKey={active} onChange={setActive} items={[
        { key: 'mine', label: '我的资源', children: <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false}/> },
        { key: 'public', label: '公共资源', children: <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false}/> },
      ]} />
      <Divider/>
      <Flex gap={8}></Flex>
    </Card>
  );
} 