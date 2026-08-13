"use client";
import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  App,
  Modal,
  Tooltip,
  Breadcrumb,
  Progress,
  Upload,
  Segmented,
  Checkbox,
  Empty,
  Popover,
  InputNumber,
  Switch,
  Select,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  FileOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FolderOutlined,
  FolderAddOutlined,
  HomeOutlined,
  PictureOutlined,
  AppstoreOutlined,
  BarsOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { apiGet, apiDelete, apiPost, apiPut, getAPI_BASE } from '@/app/_utils/api';
import { getToken, parseJwt } from '@/app/_utils/auth';
import { convertModelToGlb, needsGlbConversion, extractZipToFiles, getExt } from '@/app/_utils/modelConvert';
import { captureGlbThumbnail } from '@/app/_utils/modelThumbnail';
import ResourcePreview, { PreviewFile } from '@/app/_components/ResourcePreview';

interface FileItem {
  id: string;
  type: string;
  originalName: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
  viewUrl?: string;
  visibility?: string;
  thumbnailUrl?: string | null;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

interface Crumb { id: string | null; name: string; }

type Row =
  | ({ kind: 'folder' } & FolderItem)
  | ({ kind: 'file' } & FileItem);

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

export default function EditorResourcesPage() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [uploading, setUploading] = useState(false);

  // 上传可见性（仅超管可设为公共）
  const [isSuper, setIsSuper] = useState(false);
  const [uploadVisibility, setUploadVisibility] = useState<'private' | 'public'>('private');

  // 视图模式：列表 / 卡片
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');

  // 模型缩放设置：转换 GLB 时整体缩小的倍数（默认缩小 1000 倍）。可开关。
  const [scaleEnabled, setScaleEnabled] = useState(true);
  const [scaleDivisor, setScaleDivisor] = useState(1000);

  // 朝向校正：FBX 多为 Z-up，转 glTF(Y-up) 时会躺平/转 90°。默认绕 X 轴 -90° 矫正为竖直。
  const [orientFix, setOrientFix] = useState(-90);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('modelScaleSetting');
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.enabled === 'boolean') setScaleEnabled(s.enabled);
        if (typeof s.divisor === 'number' && s.divisor > 0) setScaleDivisor(s.divisor);
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem('modelOrientFix');
      if (raw !== null) {
        const v = Number(raw);
        if ([0, -90, 90, 180].includes(v)) setOrientFix(v);
      }
    } catch { /* ignore */ }
  }, []);

  const saveScaleSetting = (enabled: boolean, divisor: number) => {
    setScaleEnabled(enabled);
    setScaleDivisor(divisor);
    try { localStorage.setItem('modelScaleSetting', JSON.stringify({ enabled, divisor })); } catch { /* ignore */ }
  };

  const saveOrientFix = (deg: number) => {
    setOrientFix(deg);
    try { localStorage.setItem('modelOrientFix', String(deg)); } catch { /* ignore */ }
  };

  // 当前生效的缩放比例（scale=1 表示不缩放）
  const currentScale = () => (scaleEnabled && scaleDivisor > 0 ? 1 / scaleDivisor : 1);
  // 当前生效的转换选项（缩放 + 朝向校正）
  const currentConvertOptions = () => ({ scale: currentScale(), rotateXDeg: orientFix });

  // 多选
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // 拖拽移动（可能是多选批量）
  const [dragFileIds, setDragFileIds] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // folderId 或 'crumb:<id>'

  // 文件夹导航
  const [path, setPath] = useState<Crumb[]>([{ id: null, name: '全部资源' }]);
  const currentFolderId = path[path.length - 1].id;

  // 配额
  const [usage, setUsage] = useState<{ used: number; quota: number | null; remaining: number | null; unlimited?: boolean } | null>(null);

  // 新建文件夹
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const folderParam = currentFolderId === null ? 'root' : currentFolderId;

  useEffect(() => {
    const p = parseJwt(getToken());
    setIsSuper(p?.role === 'superadmin');
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const u = await apiGet<{ used: number; quota: number | null; remaining: number | null; unlimited?: boolean }>('/api/files/storage-usage');
      setUsage(u);
    } catch { /* ignore */ }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [foldersResp, filesResp] = await Promise.all([
        apiGet<{ rows: FolderItem[] }>(`/api/files/folders?parentId=${folderParam}`),
        apiGet<{ rows: FileItem[] }>(`/api/files/mine?pageSize=200&visibility=all&folderId=${folderParam}`),
      ]);
      setFolders(foldersResp.rows || []);
      setFiles(filesResp.rows || []);
    } catch (error: any) {
      message.error('加载资源列表失败');
    } finally {
      setLoading(false);
    }
  }, [folderParam, message]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadUsage(); }, [loadUsage]);

  const enterFolder = (folder: FolderItem) => {
    setSelectedFileIds([]);
    setPath((p) => [...p, { id: folder.id, name: folder.name }]);
  };

  const goToCrumb = (index: number) => {
    setSelectedFileIds([]);
    setPath((p) => p.slice(0, index + 1));
  };

  // 移动一个或多个文件到目标文件夹（null = 根目录）
  const moveFiles = async (fileIds: string[], targetFolderId: string | null) => {
    if (fileIds.length === 0) return;
    const target = targetFolderId ?? 'root';
    try {
      let ok = 0; let fail = 0;
      for (const id of fileIds) {
        try { await apiPut(`/api/files/${id}/folder`, { folderId: target }); ok++; } catch { fail++; }
      }
      message[fail ? 'warning' : 'success'](fail ? `已移动 ${ok} 个，失败 ${fail} 个` : `已移动 ${ok} 个`);
      setSelectedFileIds([]);
      loadData();
    } catch (e: any) {
      message.error(e?.message || '移动失败');
    }
  };

  // 批量删除选中的文件
  const batchDelete = () => {
    if (selectedFileIds.length === 0) return;
    modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedFileIds.length} 个资源吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        let ok = 0; let fail = 0;
        for (const id of selectedFileIds) {
          try { await apiDelete(`/api/files/${id}`); ok++; } catch { fail++; }
        }
        message[fail ? 'warning' : 'success'](fail ? `已删除 ${ok} 个，失败 ${fail} 个` : `已删除 ${ok} 个`);
        setSelectedFileIds([]);
        loadData();
        loadUsage();
      },
    });
  };

  const handleDeleteFile = (file: FileItem) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${file.originalName}" 吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiDelete(`/api/files/${file.id}`);
          message.success('删除成功');
          loadData();
          loadUsage();
        } catch (error: any) {
          message.error(error?.message || '删除失败');
        }
      },
    });
  };

  const handleDeleteFolder = (folder: FolderItem) => {
    modal.confirm({
      title: '确认删除文件夹',
      content: `确定要删除文件夹 "${folder.name}" 吗？将连同其中的所有子文件夹和资源一并删除，此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const r = await apiDelete<{ ok: boolean; deletedFolders?: number; deletedFiles?: number }>(`/api/files/folder/${folder.id}`);
          const df = r?.deletedFiles || 0;
          message.success(df > 0 ? `已删除文件夹及其中 ${df} 个资源` : '删除成功');
          loadData();
          loadUsage();
        } catch (error: any) {
          message.error(error?.message || '删除失败');
        }
      },
    });
  };

  const createFolder = async () => {
    const name = newFolderName.trim();
    if (!name) { message.warning('请输入文件夹名称'); return; }
    try {
      await apiPost('/api/files/folder', { name, parentId: currentFolderId });
      message.success('创建成功');
      setFolderModalOpen(false);
      setNewFolderName('');
      loadData();
    } catch (error: any) {
      message.error(error?.message || '创建失败');
    }
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  // 为模型自动生成截图封面并上传（仅 .glb）。失败不影响上传主流程。
  const maybeUploadCover = async (fileId: string | undefined, blob: Blob, name: string) => {
    if (!fileId) return;
    if (getExt(name) !== '.glb') return;
    try {
      const png = await captureGlbThumbnail(blob, { size: 512 });
      const fd = new FormData();
      fd.append('file', png, 'cover.png');
      await fetch(`${getAPI_BASE()}/api/files/${fileId}/cover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
    } catch { /* 截图失败忽略，不影响资源本身 */ }
  };

  // 手动更换封面（上传自定义图片）
  const replaceCover = async (fileId: string, img: File) => {
    try {
      const fd = new FormData();
      fd.append('file', img);
      const res = await fetch(`${getAPI_BASE()}/api/files/${fileId}/cover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.message || '更换封面失败'); }
      message.success('封面已更新');
      loadData();
    } catch (e: any) {
      message.error(e?.message || '更换封面失败');
    }
  };

  // 单文件上传（模型自动转 GLB）
  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      let toUpload = file;
      if (needsGlbConversion(file.name)) {
        message.loading({ content: `正在将 ${file.name} 转换为 GLB（Unity 兼容格式）...`, key: 'conv', duration: 0 });
        try {
          toUpload = await convertModelToGlb(file, undefined, currentConvertOptions());
          message.success({ content: `已转换为 ${toUpload.name}`, key: 'conv' });
        } catch (e: any) {
          message.error({ content: `模型转换失败：${e?.message || '未知错误'}`, key: 'conv' });
          setUploading(false);
          return;
        }
      }
      const fd = new FormData();
      fd.append('file', toUpload);
      if (currentFolderId) fd.append('folderId', currentFolderId);
      if (isSuper && uploadVisibility === 'public') fd.append('visibility', 'public');
      const res = await fetch(`${getAPI_BASE()}/api/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || '上传失败');
      message.success(`${toUpload.name} 上传成功`);
      // 模型自动生成封面截图
      await maybeUploadCover(data?.file?._id, toUpload, toUpload.name);
      loadData();
      loadUsage();
    } catch (e: any) {
      message.error(e?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 上传单个 File 到指定目录（默认当前目录），返回是否成功
  const uploadOneFile = async (f: File, folderId?: string | null): Promise<boolean> => {
    const target = folderId === undefined ? currentFolderId : folderId;
    const fd = new FormData();
    fd.append('file', f);
    if (target) fd.append('folderId', target);
    if (isSuper && uploadVisibility === 'public') fd.append('visibility', 'public');
    const res = await fetch(`${getAPI_BASE()}/api/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    await maybeUploadCover(data?.file?._id, f, f.name);
    return true;
  };

  // 按 ZIP 内目录层级，逐级获取/创建文件夹，返回叶子目录的 folderId。
  // 使用缓存避免重复创建；根目录(空 segments)返回 currentFolderId。
  const ensureFolderPath = async (
    segments: string[],
    cache: Map<string, string | null>,
  ): Promise<string | null> => {
    let parentId: string | null = currentFolderId;
    let accKey = '';
    for (const seg of segments) {
      accKey = accKey ? `${accKey}/${seg}` : seg;
      if (cache.has(accKey)) { parentId = cache.get(accKey)!; continue; }
      const resp = await apiPost<{ ok: boolean; folder: { id: string } }>('/api/files/folder', {
        name: seg,
        parentId,
      });
      const fid = resp?.folder?.id ?? null;
      cache.set(accKey, fid);
      parentId = fid;
    }
    return parentId;
  };

  // ZIP 上传：浏览器端解压，模型(fbx/obj/stl)自动转 GLB，
  // 按 ZIP 内目录层级自动建文件夹，再逐个上传到对应目录
  const doUploadZip = async (file: File) => {
    setUploading(true);
    try {
      message.loading({ content: '正在解压并转换压缩包内的模型...', key: 'zip', duration: 0 });
      const { items, skipped, convertFailed } = await extractZipToFiles(
        file,
        (cur, total, name) => message.loading({ content: `解压中 ${cur}/${total}：${name}`, key: 'zip', duration: 0 }),
        currentConvertOptions(),
      );
      if (items.length === 0) {
        message.warning({ content: '压缩包内没有平台支持的资源文件', key: 'zip' });
        return;
      }
      const folderCache = new Map<string, string | null>();
      let ok = 0;
      let fail = 0;
      for (let i = 0; i < items.length; i++) {
        const { file: f, dir } = items[i];
        message.loading({ content: `上传中 ${i + 1}/${items.length}：${dir.length ? dir.join('/') + '/' : ''}${f.name}`, key: 'zip', duration: 0 });
        try {
          const folderId = await ensureFolderPath(dir, folderCache);
          (await uploadOneFile(f, folderId)) ? ok++ : fail++;
        } catch { fail++; }
      }
      const folderCount = folderCache.size;
      const parts = [`导入 ${ok} 个资源`];
      if (folderCount) parts.push(`创建 ${folderCount} 个文件夹`);
      if (fail) parts.push(`失败 ${fail} 个（可能超出配额）`);
      if (convertFailed.length) parts.push(`${convertFailed.length} 个模型转换失败`);
      if (skipped.length) parts.push(`跳过 ${skipped.length} 个不支持的文件`);
      message[fail || convertFailed.length ? 'warning' : 'success']({ content: `解压完成：${parts.join('，')}`, key: 'zip' });
      loadData();
      loadUsage();
    } catch (e: any) {
      message.error({ content: e?.message || '解压上传失败', key: 'zip' });
    } finally {
      setUploading(false);
    }
  };

  // 统一上传入口：自动识别压缩包(.zip)走解压流程，其它走单文件上传
  const handleAutoUpload = (file: File) => {
    if (getExt(file.name) === '.zip') doUploadZip(file);
    else doUpload(file);
  };

  const getFileIcon = (type: string) => {
    if (type === '图片') return <FileImageOutlined style={{ color: '#10b981' }} />;
    if (type === 'PDF') return <FilePdfOutlined style={{ color: '#ef4444' }} />;
    if (type === '模型') return <FileOutlined style={{ color: '#8b5cf6' }} />;
    return <FileOutlined style={{ color: '#6b7280' }} />;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case '图片': return 'green';
      case '模型': return 'purple';
      case 'PDF': return 'red';
      case '视频': return 'blue';
      default: return 'default';
    }
  };

  const rows: Row[] = [
    ...folders
      .filter((f) => f.name.toLowerCase().includes(searchText.toLowerCase()))
      .map((f) => ({ kind: 'folder' as const, ...f })),
    ...files
      .filter((f) => f.originalName.toLowerCase().includes(searchText.toLowerCase()))
      .map((f) => ({ kind: 'file' as const, ...f })),
  ];

  const columns = [
    {
      title: '名称',
      key: 'name',
      render: (_: any, record: Row) => {
        if (record.kind === 'folder') {
          return (
            <Space style={{ cursor: 'pointer' }} onClick={() => enterFolder(record)}>
              <FolderOutlined style={{ color: '#f59e0b' }} />
              <span style={{ color: '#fff' }}>{record.name}</span>
            </Space>
          );
        }
        return (
          <Space style={{ cursor: 'grab' }}>
            {getFileIcon(record.type)}
            <span style={{ color: '#fff' }}>{record.originalName}</span>
          </Space>
        );
      },
    },
    {
      title: '类型',
      key: 'type',
      width: 100,
      render: (_: any, record: Row) =>
        record.kind === 'folder'
          ? <Tag color="orange">文件夹</Tag>
          : <Tag color={getTypeColor(record.type)}>{record.type}</Tag>,
    },
    {
      title: '可见性',
      key: 'visibility',
      width: 90,
      render: (_: any, record: Row) =>
        record.kind === 'file'
          ? <Tag color={record.visibility === 'public' ? 'gold' : 'default'}>{record.visibility === 'public' ? '公共' : '私有'}</Tag>
          : '-',
    },
    {
      title: '大小',
      key: 'size',
      width: 110,
      render: (_: any, record: Row) => (record.kind === 'file' ? formatBytes(record.size) : '-'),
    },
    {
      title: '创建时间',
      key: 'createdAt',
      width: 170,
      render: (_: any, record: Row) => new Date(record.createdAt).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_: any, record: Row) => (
        <Space>
          {record.kind === 'file' && (
            <Tooltip title="预览">
              <Button type="text" size="small" icon={<EyeOutlined />}
                onClick={() => setPreviewFile({ id: record.id, type: record.type, originalName: record.originalName, downloadUrl: record.downloadUrl })}
                style={{ color: 'rgba(255,255,255,0.7)' }} />
            </Tooltip>
          )}
          <Tooltip title="删除">
            <Button type="text" size="small" danger icon={<DeleteOutlined />}
              onClick={() => record.kind === 'folder' ? handleDeleteFolder(record) : handleDeleteFile(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const usagePercent = usage && !usage.unlimited && usage.quota && usage.quota > 0 ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0;

  // 多选：仅文件可选
  const rowSelection = {
    selectedRowKeys: selectedFileIds.map((id) => `file-${id}`),
    onChange: (keys: React.Key[]) => {
      setSelectedFileIds(keys.map((k) => String(k).replace(/^file-/, '')));
    },
    getCheckboxProps: (record: Row) => ({ disabled: record.kind === 'folder' }),
  };

  // 拖拽：文件行可拖动（若拖动已选中文件，则批量拖动所有选中）；文件夹行为放置目标
  const onRow = (record: Row) => ({
    draggable: record.kind === 'file',
    onDragStart: () => {
      if (record.kind === 'file') {
        // 若拖动的是已选中文件，则批量拖动全部选中；否则只拖该文件
        setDragFileIds(selectedFileIds.includes(record.id) ? selectedFileIds : [record.id]);
      }
    },
    onDragEnd: () => { setDragFileIds([]); setDropTarget(null); },
    onDragOver: (e: React.DragEvent) => {
      if (record.kind === 'folder' && dragFileIds.length) { e.preventDefault(); setDropTarget(record.id); }
    },
    onDragLeave: () => { if (record.kind === 'folder') setDropTarget((t) => (t === record.id ? null : t)); },
    onDrop: (e: React.DragEvent) => {
      if (record.kind === 'folder' && dragFileIds.length) {
        e.preventDefault();
        moveFiles(dragFileIds, record.id);
        setDragFileIds([]); setDropTarget(null);
      }
    },
    style: record.kind === 'folder' && dropTarget === record.id
      ? { background: 'rgba(139,92,246,0.25)' }
      : undefined,
  });

  // 卡片视图渲染
  const renderCards = () => {
    if (loading) {
      return <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.6)' }}>加载中...</div>;
    }
    if (rows.length === 0) {
      return <Empty description={<span style={{ color: 'rgba(255,255,255,0.5)' }}>当前目录暂无内容</span>} style={{ padding: 40 }} />;
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {rows.map((record) => {
          if (record.kind === 'folder') {
            return (
              <div
                key={`folder-${record.id}`}
                onClick={() => enterFolder(record)}
                onDragOver={(e) => { if (dragFileIds.length) { e.preventDefault(); setDropTarget(record.id); } }}
                onDragLeave={() => setDropTarget((t) => (t === record.id ? null : t))}
                onDrop={(e) => { if (dragFileIds.length) { e.preventDefault(); moveFiles(dragFileIds, record.id); setDragFileIds([]); setDropTarget(null); } }}
                style={{
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 180, borderRadius: 12, gap: 10,
                  background: dropTarget === record.id ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <FolderOutlined style={{ fontSize: 48, color: '#f59e0b' }} />
                <span style={{ color: '#fff', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.name}</span>
              </div>
            );
          }
          const selected = selectedFileIds.includes(record.id);
          const coverSrc = record.thumbnailUrl ? `${getAPI_BASE()}${record.thumbnailUrl}` : '';
          const previewIt = () => setPreviewFile({ id: record.id, type: record.type, originalName: record.originalName, downloadUrl: record.downloadUrl });
          return (
            <div
              key={`file-${record.id}`}
              draggable
              onDragStart={() => setDragFileIds(selectedFileIds.includes(record.id) ? selectedFileIds : [record.id])}
              onDragEnd={() => { setDragFileIds([]); setDropTarget(null); }}
              style={{ position: 'relative' }}
            >
              <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
                <Checkbox
                  checked={selected}
                  onChange={(e) => {
                    setSelectedFileIds((ids) => e.target.checked ? [...ids, record.id] : ids.filter((x) => x !== record.id));
                  }}
                />
              </div>
              <Card
                hoverable
                size="small"
                styles={{ body: { padding: 10 } }}
                style={{ background: 'rgba(255,255,255,0.04)', border: selected ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}
                cover={
                  <div onClick={previewIt} style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', cursor: 'pointer' }}>
                    {coverSrc ? (
                      <img src={coverSrc} alt={record.originalName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 56 }}>{getFileIcon(record.type)}</span>
                    )}
                  </div>
                }
                actions={[
                  <Tooltip title="预览" key="preview"><EyeOutlined onClick={previewIt} /></Tooltip>,
                  <Upload key="cover" showUploadList={false} accept="image/*" beforeUpload={(img) => { replaceCover(record.id, img as File); return false; }}>
                    <Tooltip title="更换封面"><PictureOutlined /></Tooltip>
                  </Upload>,
                  <Tooltip title="删除" key="delete"><DeleteOutlined style={{ color: '#ef4444' }} onClick={() => handleDeleteFile(record)} /></Tooltip>,
                ]}
              >
                <Card.Meta
                  title={<span style={{ color: '#fff', fontSize: 13 }}>{record.originalName}</span>}
                  description={
                    <Space size={4} wrap>
                      <Tag color={getTypeColor(record.type)} style={{ marginInlineEnd: 0 }}>{record.type}</Tag>
                      <Tag color={record.visibility === 'public' ? 'gold' : 'default'} style={{ marginInlineEnd: 0 }}>{record.visibility === 'public' ? '公共' : '私有'}</Tag>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{formatBytes(record.size)}</span>
                    </Space>
                  }
                />
              </Card>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#fff', margin: 0 }}>资源管理</h1>
        <Space wrap>
          {isSuper && (
            <Segmented
              value={uploadVisibility}
              onChange={(v) => setUploadVisibility(v as 'private' | 'public')}
              options={[{ label: '私有', value: 'private' }, { label: '公共', value: 'public' }]}
            />
          )}
          <Button icon={<FolderAddOutlined />} onClick={() => setFolderModalOpen(true)}>新建文件夹</Button>
          <Upload showUploadList={false} multiple beforeUpload={(file) => { handleAutoUpload(file as File); return false; }}>
            <Button type="primary" icon={<UploadOutlined />} loading={uploading}
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', border: 'none' }}>
              上传资源{isSuper ? `（${uploadVisibility === 'public' ? '公共' : '私有'}）` : ''}
            </Button>
          </Upload>
          <Popover
            trigger="click"
            placement="bottomRight"
            title="模型转换设置"
            content={
              <div style={{ width: 260 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span>转换时缩小模型</span>
                  <Switch checked={scaleEnabled} onChange={(v) => saveScaleSetting(v, scaleDivisor)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span>缩小倍数</span>
                  <InputNumber
                    min={1}
                    disabled={!scaleEnabled}
                    value={scaleDivisor}
                    onChange={(v) => saveScaleSetting(scaleEnabled, Number(v) || 1)}
                    style={{ width: 120 }}
                  />
                  <span>倍</span>
                </div>
                <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 12 }}>
                  对 FBX/OBJ/STL 转 GLB 生效（默认缩小 1000 倍，常用于 mm→m）。GLB 直传不缩放。
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span>朝向校正（绕X轴）</span>
                  <Select
                    value={orientFix}
                    onChange={(v) => saveOrientFix(Number(v))}
                    style={{ width: 110 }}
                    options={[
                      { value: -90, label: '-90°（推荐）' },
                      { value: 0, label: '不校正' },
                      { value: 90, label: '+90°' },
                      { value: 180, label: '180°' },
                    ]}
                  />
                </div>
                <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                  FBX 多为 Z-up，导入后会躺平/转 90°，默认 -90° 矫正为竖直。GLB 直传不旋转。
                </div>
              </div>
            }
          >
            <Tooltip title="模型转换设置">
              <Button icon={<SettingOutlined />}>
                {scaleEnabled ? `缩小${scaleDivisor}倍` : '原始比例'}
              </Button>
            </Tooltip>
          </Popover>
        </Space>
      </div>

      {/* 存储配额 */}
      {usage && (
        <Card size="small" style={{ marginBottom: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {usage.unlimited ? (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                存储空间：已用 {formatBytes(usage.used)}（管理员账号不限容量，上传的公共资源不占用个人空间）
              </span>
            </Space>
          ) : (
            <>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>
                  存储空间：{formatBytes(usage.used)} / {formatBytes(usage.quota || 0)}（剩余 {formatBytes(usage.remaining || 0)}）
                </span>
              </Space>
              <Progress percent={usagePercent} status={usagePercent >= 100 ? 'exception' : 'active'} strokeColor={usagePercent >= 90 ? '#ef4444' : '#8b5cf6'} />
            </>
          )}
        </Card>
      )}

      <Card style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16 }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Breadcrumb
            items={path.map((c, idx) => ({
              title: (
                <span
                  style={{
                    cursor: 'pointer',
                    padding: '2px 8px',
                    borderRadius: 6,
                    color: idx === path.length - 1 ? '#fff' : 'rgba(255,255,255,0.6)',
                    background: dropTarget === `crumb:${idx}` ? 'rgba(139,92,246,0.35)' : 'transparent',
                  }}
                  onClick={() => goToCrumb(idx)}
                  onDragOver={(e) => { if (dragFileIds.length) { e.preventDefault(); setDropTarget(`crumb:${idx}`); } }}
                  onDragLeave={() => setDropTarget((t) => (t === `crumb:${idx}` ? null : t))}
                  onDrop={(e) => {
                    if (dragFileIds.length) {
                      e.preventDefault();
                      moveFiles(dragFileIds, c.id);
                      setDragFileIds([]); setDropTarget(null);
                    }
                  }}
                >
                  {idx === 0 ? <HomeOutlined /> : null} {c.name}
                </span>
              ),
            }))}
          />
          <Space>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as 'list' | 'card')}
              options={[
                { label: '卡片', value: 'card', icon: <AppstoreOutlined /> },
                { label: '列表', value: 'list', icon: <BarsOutlined /> },
              ]}
            />
            <Input
              prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />}
              placeholder="搜索当前目录..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ maxWidth: 280, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </Space>
        </div>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            提示：上传支持单个文件或 .zip 压缩包（自动解压）；勾选复选框可多选；拖动文件到文件夹可移入，拖到面包屑可移出。
          </span>
          {selectedFileIds.length > 0 && (
            <Space>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>已选 {selectedFileIds.length} 项</span>
              <Button size="small" onClick={() => setSelectedFileIds([])}>取消选择</Button>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={batchDelete}>批量删除</Button>
            </Space>
          )}
        </div>

        {viewMode === 'list' ? (
          <Table
            dataSource={rows}
            columns={columns}
            rowKey={(r: Row) => `${r.kind}-${r.id}`}
            loading={loading}
            pagination={{ pageSize: 12 }}
            style={{ color: '#fff' }}
            onRow={onRow as any}
            rowSelection={rowSelection as any}
          />
        ) : (
          renderCards()
        )}
      </Card>

      {/* 新建文件夹 */}
      <Modal open={folderModalOpen} title="新建文件夹" onCancel={() => setFolderModalOpen(false)} onOk={createFolder} okText="创建" cancelText="取消">
        <Input placeholder="请输入文件夹名称" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onPressEnter={createFolder} maxLength={100} />
      </Modal>

      {/* 预览弹窗：图片 / 模型(本地three.js) / 视频 / PDF */}
      <ResourcePreview file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
}
