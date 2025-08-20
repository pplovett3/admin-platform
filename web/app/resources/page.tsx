"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Divider, Flex, Input, message, Select, Space, Table, Tabs, Upload } from "antd";
import type { UploadProps } from "antd";
import { InboxOutlined, DownloadOutlined } from "@ant-design/icons";
import { authDownload, authFetch } from "../_lib/api";
import { API_URL } from "../_lib/api";

interface FileRow { id: string; type: string; originalName: string; size: number; createdAt: string; downloadUrl: string; visibility?: string }

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

  const columns = useMemo(() => [
    { title: "名称", dataIndex: "originalName" },
    { title: "类型", dataIndex: "type" },
    { title: "大小", dataIndex: "size", render: (v:number)=>humanSize(v) },
    { title: "上传时间", dataIndex: "createdAt", render: (v:string)=>new Date(v).toLocaleString() },
    { title: "操作", key: "op", render: (_:any, r:FileRow)=> <Space>
      <Button icon={<DownloadOutlined/>} onClick={()=>authDownload(r.downloadUrl, r.originalName)}>下载</Button>
    </Space> },
  ],[]);

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
    showUploadList: false,
    action: undefined,
    customRequest: async (options) => {
      const { file, onError, onSuccess } = options as any;
      try {
        const fd = new FormData();
        fd.append("file", file as any);
        const token = (typeof localStorage !== 'undefined' && (localStorage.getItem('token')||localStorage.getItem('authToken'))) || '';
        const res = await fetch(`${API_URL}/api/files/upload`, {
          method: 'POST',
          headers: { Authorization: token ? `Bearer ${token}` : '' },
          body: fd,
        });
        if (!res.ok) throw new Error(((await res.json())||{}).message||res.statusText);
        onSuccess && onSuccess(await res.json());
        message.success("上传成功");
        refresh();
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
      <Upload {...uploadProps}><Button type="primary">上传文件</Button></Upload>
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