"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { Button, Card, Divider, Flex, Input, message, Popconfirm, Select, Space, Table, Tabs, Upload, Switch, Tag, Progress } from "antd";
import type { UploadProps } from "antd";
import { EyeOutlined, DownloadOutlined, DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { authDownload, authFetch } from "../_lib/api";
import { getAPI_URL, getCurrentRole } from "../_lib/api";

interface FileRow { id: string; type: string; originalName: string; size: number; createdAt: string; downloadUrl: string; viewUrl?: string; visibility?: string; storageRelPath?: string }

// 分块大小：50MB（小于 Cloudflare 100MB 限制）
const CHUNK_SIZE = 50 * 1024 * 1024;

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
  const [chunkUploading, setChunkUploading] = useState(false);
  const [chunkProgress, setChunkProgress] = useState(0);
  const [chunkStatus, setChunkStatus] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const role = getCurrentRole();

  // 分块上传函数
  const uploadWithChunks = async (
    file: File, 
    visibility: string,
    onProgress: (percent: number) => void
  ) => {
    const token = (typeof localStorage !== 'undefined' && (localStorage.getItem('token')||localStorage.getItem('authToken'))) || '';
    const apiUrl = getAPI_URL();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1. 初始化分块上传
    setChunkStatus('初始化上传...');
    const initRes = await fetch(`${apiUrl}/api/files/chunk/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
        visibility,
      }),
    });

    if (!initRes.ok) {
      const err = await initRes.json();
      throw new Error(err.message || '初始化上传失败');
    }

    const { uploadId } = await initRes.json();
    abortControllerRef.current = new AbortController();

    try {
      // 2. 逐块上传
      for (let i = 0; i < totalChunks; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('上传已取消');
        }

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        setChunkStatus(`上传中 ${i + 1}/${totalChunks}...`);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(i));
        formData.append('chunk', chunk);

        const uploadRes = await fetch(`${apiUrl}/api/files/chunk/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
          signal: abortControllerRef.current?.signal,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.message || `分块 ${i + 1} 上传失败`);
        }

        const progress = Math.round(((i + 1) / totalChunks) * 90);
        setChunkProgress(progress);
        onProgress(progress);
      }

      // 3. 完成上传
      setChunkStatus('合并文件中...');
      setChunkProgress(95);
      onProgress(95);

      const completeRes = await fetch(`${apiUrl}/api/files/chunk/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ uploadId }),
      });

      if (!completeRes.ok) {
        const err = await completeRes.json();
        throw new Error(err.message || '文件合并失败');
      }

      setChunkProgress(100);
      onProgress(100);
      return await completeRes.json();

    } catch (error) {
      // 清理失败的上传会话
      try {
        await fetch(`${apiUrl}/api/files/chunk/${uploadId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {}
      throw error;
    }
  };

  const columns = useMemo(() => [
    { title: "名称", dataIndex: "originalName" },
    { title: "类型", dataIndex: "type" },
    { title: "大小", dataIndex: "size", render: (v:number)=>humanSize(v) },
    { title: "上传时间", dataIndex: "createdAt", render: (v:string)=>new Date(v).toLocaleString() },
    { title: "操作", key: "op", render: (_:any, r:FileRow)=> <Space>
      {((r.type==='图片'||r.type==='视频') && r.viewUrl) && <Button icon={<EyeOutlined/>} onClick={()=> window.open(r.viewUrl!, '_blank')}>查看</Button>}
      {(r.type==='模型') && (()=>{
        const raw = (r.viewUrl||r.downloadUrl||'');
        const lower = raw.toLowerCase();
        if (!(lower.endsWith('.glb') || lower.includes('.glb?'))) return null;
        const viewerSrc = raw; // 直接使用直链：video.yf-xr.com 或 dl.yf-xr.com
        return (
          <Space>
            <Button 
              icon={<EyeOutlined/>} 
              onClick={()=> window.open(`/resources/viewer/model?src=${encodeURIComponent(viewerSrc)}`,'_blank')}
            >
              查看
            </Button>
            <Button 
              size="small" 
              type="link"
              onClick={()=> window.open('https://github.khronos.org/glTF-Validator/', '_blank')}
              title="如果模型无法正常显示，建议使用此工具验证GLB文件"
            >
              验证GLB
            </Button>
          </Space>
        );
      })()}
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
      const shouldHideEditorSaved = (name: string) => /^(courseware-).*(-modified\.glb)$/i.test(name || '');
      if (active === "mine") {
        const resp = await authFetch<{ rows: FileRow[] }>(`/api/files/mine?${qs}`);
        setRows((resp.rows||[]).filter(r=>!shouldHideEditorSaved(r.originalName||'')));
      } else {
        const resp = await authFetch<{ rows: FileRow[] }>(`/api/files/public?${qs}`);
        setRows((resp.rows||[]).filter(r=>!shouldHideEditorSaved(r.originalName||'')));
      }
    } catch (e:any) {
      message.error(e?.message||"加载失败");
    } finally { setLoading(false); }
  }

  useEffect(()=>{ refresh(); }, [active, type]);

  const uploadProps: UploadProps = {
    name: "file",
    multiple: false,
    showUploadList: !chunkUploading,
    action: undefined,
    customRequest: async (options) => {
      const { file, onError, onSuccess, onProgress } = options as any;
      const fileObj = file as File;
      const visibility = (role === 'superadmin' && isPublicUpload) ? 'public' : 'private';

      try {
        // 大于 80MB 使用分块上传
        if (fileObj.size > 80 * 1024 * 1024) {
          setChunkUploading(true);
          setChunkProgress(0);
          setChunkStatus('准备上传...');

          const result = await uploadWithChunks(
            fileObj,
            visibility,
            (percent) => onProgress?.({ percent })
          );

          onSuccess?.(result);
          message.success('上传成功');
          refresh();
          setChunkUploading(false);
          setChunkProgress(0);
          setChunkStatus('');
        } else {
          // 小文件普通上传
          const fd = new FormData();
          fd.append("file", fileObj);
          if (visibility === 'public') fd.append('visibility', 'public');
          const token = (typeof localStorage !== 'undefined' && (localStorage.getItem('token')||localStorage.getItem('authToken'))) || '';
          const xhr = new XMLHttpRequest();
          const apiUrl = getAPI_URL();
          xhr.open('POST', `${apiUrl}/api/files/upload`);
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
        }
      } catch (e:any) {
        message.error(e?.message||"上传失败");
        onError && onError(e);
        setChunkUploading(false);
        setChunkProgress(0);
        setChunkStatus('');
      }
    }
  };

  return (
    <Card title="资源管理" extra={<Space>
      <Select placeholder="类型" allowClear style={{ width: 140 }} onChange={setType}
        options={[{value:'video',label:'视频'},{value:'image',label:'图片'},{value:'pdf',label:'PDF'},{value:'ppt',label:'PPT'},{value:'word',label:'Word'}]} />
      <Input.Search placeholder="搜索文件名" allowClear onSearch={()=>refresh()} onChange={(e)=>setQ(e.target.value)} style={{width:240}} />
      {role==='superadmin' && <Space size={6}><Tag>公开资源</Tag><Switch checked={isPublicUpload} onChange={setIsPublicUpload} /></Space>}
      <Upload {...uploadProps}><Button type="primary" icon={<UploadOutlined/>} disabled={chunkUploading}>上传文件</Button></Upload>
      {chunkUploading && (
        <Space>
          <Progress percent={chunkProgress} size="small" style={{ width: 150 }} />
          <span style={{ fontSize: 12, color: '#999' }}>{chunkStatus}</span>
        </Space>
      )}
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