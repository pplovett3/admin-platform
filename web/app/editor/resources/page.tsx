"use client";
import { useEffect, useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Upload, 
  Space, 
  Tag, 
  Input, 
  App,
  Modal,
  Tooltip
} from 'antd';
import { 
  UploadOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  SearchOutlined,
  FileOutlined,
  FileImageOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { apiGet, apiDelete, authHeaders, getAPI_BASE } from '@/app/_utils/api';
import type { UploadProps } from 'antd';

interface FileItem {
  id: string;
  type: string;
  originalName: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
  viewUrl?: string;
  visibility?: string;
}

export default function EditorResourcesPage() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const resp = await apiGet<{ rows: FileItem[], total: number }>('/api/files/mine?pageSize=100');
      setFiles(resp.rows || []);
    } catch (error: any) {
      message.error('加载资源列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (file: FileItem) => {
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
          loadFiles();
        } catch (error: any) {
          message.error(error?.message || '删除失败');
        }
      },
    });
  };

  const uploadProps: UploadProps = {
    name: 'file',
    action: '/api/files/upload', // 使用相对路径，通过 Next.js 代理
    headers: {
      Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''}`,
    },
    showUploadList: false,
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 上传成功`);
        loadFiles();
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`);
      }
    },
  };

  const getFileIcon = (type: string) => {
    if (type === '图片') {
      return <FileImageOutlined style={{ color: '#10b981' }} />;
    }
    if (type === 'PDF') {
      return <FilePdfOutlined style={{ color: '#ef4444' }} />;
    }
    if (type === '模型') {
      return <FileOutlined style={{ color: '#8b5cf6' }} />;
    }
    return <FileOutlined style={{ color: '#6b7280' }} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

  const filteredFiles = files.filter(file => 
    file.originalName.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: '文件名',
      dataIndex: 'originalName',
      key: 'originalName',
      render: (name: string, record: FileItem) => (
        <Space>
          {getFileIcon(record.type)}
          <span style={{ color: '#fff' }}>{name}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag color={getTypeColor(type)}>{type}</Tag>,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: FileItem) => (
        <Space>
          <Tooltip title="预览">
            <Button 
              type="text" 
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setPreviewUrl(record.downloadUrl)}
              style={{ color: 'rgba(255,255,255,0.7)' }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button 
              type="text" 
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 32 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24
      }}>
        <h1 style={{ 
          fontSize: 24, 
          fontWeight: 600, 
          color: '#fff',
          margin: 0
        }}>
          资源管理
        </h1>
        <Upload {...uploadProps}>
          <Button 
            type="primary" 
            icon={<UploadOutlined />}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              border: 'none',
            }}
          >
            上传资源
          </Button>
        </Upload>
      </div>

      <Card
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />}
            placeholder="搜索文件名..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ 
              maxWidth: 320,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          />
        </div>

        <Table
          dataSource={filteredFiles}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          style={{ color: '#fff' }}
        />
      </Card>

      {/* 预览弹窗 */}
      <Modal
        open={!!previewUrl}
        onCancel={() => setPreviewUrl(null)}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        {previewUrl && (
          <div style={{ textAlign: 'center' }}>
            <img 
              src={previewUrl} 
              alt="预览" 
              style={{ maxWidth: '100%', maxHeight: '70vh' }}
              onError={() => {
                message.info('此文件类型不支持预览');
                setPreviewUrl(null);
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

