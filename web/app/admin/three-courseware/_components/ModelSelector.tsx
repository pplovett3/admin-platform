"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Radio, List, Avatar, Upload, Button, Input, Space, App, Spin, Empty, Pagination, Badge, Progress } from 'antd';
import { InboxOutlined, CloudUploadOutlined, FileOutlined, GlobalOutlined } from '@ant-design/icons';
import { apiGet, apiPost } from '@/app/_utils/api';
import type { UploadProps } from 'antd';

interface ModelItem {
  id: string;
  name: string;
  size: number;
  type: 'personal' | 'public';
  createdAt: string;
  downloadUrl: string;
  viewUrl?: string;
}

interface ModelSelectorProps {
  open: boolean;
  onCancel: () => void;
  onSelect: (modelUrl: string, modelName: string) => void;
}

// 分块大小：50MB（小于 Cloudflare 100MB 限制）
const CHUNK_SIZE = 50 * 1024 * 1024;

export default function ModelSelector({ open, onCancel, onSelect }: ModelSelectorProps) {
  const [mode, setMode] = useState<'platform' | 'upload'>('platform');
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [selectedModel, setSelectedModel] = useState<ModelItem | null>(null);
  const { message } = App.useApp();
  const abortControllerRef = useRef<AbortController | null>(null);

  // 加载模型列表
  const loadModels = async (page = 1, search = '') => {
    if (mode !== 'platform') return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { q: search })
      });
      
      const response = await apiGet<{
        models: ModelItem[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/api/coursewares/resources/models?${params}`);
      
      setModels(response.models);
      setPagination(response.pagination);
    } catch (error: any) {
      message.error(error.message || '加载模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, page: 1 }));
    loadModels(1, value);
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    loadModels(page, searchText);
  };

  // 分块上传函数
  const uploadWithChunks = async (file: File) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('未登录');
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // 1. 初始化分块上传
    setUploadStatus('初始化上传...');
    const initRes = await fetch('/api/files/chunk/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
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

        setUploadStatus(`上传中 ${i + 1}/${totalChunks}...`);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(i));
        formData.append('chunk', chunk);

        const uploadRes = await fetch('/api/files/chunk/upload', {
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

        const progress = Math.round(((i + 1) / totalChunks) * 90); // 90% 用于上传
        setUploadProgress(progress);
      }

      // 3. 完成上传（合并分块）
      setUploadStatus('合并文件中...');
      setUploadProgress(95);

      const completeRes = await fetch('/api/files/chunk/complete', {
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

      setUploadProgress(100);
      const result = await completeRes.json();
      return result;

    } catch (error) {
      // 清理失败的上传会话
      try {
        await fetch(`/api/files/chunk/${uploadId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {}
      throw error;
    }
  };

  // 普通上传函数（小文件）
  const uploadNormal = async (file: File) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('未登录');
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || '上传失败');
    }

    return await res.json();
  };

  // 自定义上传处理
  const handleCustomUpload = async (file: File) => {
    // 验证文件类型
    const isModel = ['.glb', '.fbx', '.obj', '.stl'].some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    if (!isModel) {
      message.error('只支持 GLB、FBX、OBJ、STL 格式的模型文件');
      return;
    }

    // 验证文件大小
    const isLt500M = file.size / 1024 / 1024 < 500;
    if (!isLt500M) {
      message.error('模型文件大小不能超过 500MB');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('准备上传...');

    try {
      let result;
      
      // 大于 80MB 使用分块上传（留一些余量）
      if (file.size > 80 * 1024 * 1024) {
        result = await uploadWithChunks(file);
      } else {
        setUploadStatus('上传中...');
        result = await uploadNormal(file);
        setUploadProgress(100);
      }

      if (result?.ok && result?.downloadUrl) {
        message.success('模型上传成功');
        onSelect(result.downloadUrl, file.name);
      } else {
        message.error('上传失败');
      }
    } catch (error: any) {
      if (error.message !== '上传已取消') {
        message.error(`上传失败: ${error.message || '未知错误'}`);
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      abortControllerRef.current = null;
    }
  };

  // 取消上传
  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      message.info('上传已取消');
    }
  };

  // 上传配置（用于拖拽区域触发）
  const uploadProps: UploadProps = {
    name: 'file',
    accept: '.glb,.fbx,.obj,.stl',
    showUploadList: false,
    beforeUpload: (file) => {
      handleCustomUpload(file);
      return false; // 阻止默认上传行为
    },
  };

  // 选择模型处理
  const handleSelectModel = () => {
    if (!selectedModel) {
      message.warning('请选择一个模型');
      return;
    }
    onSelect(selectedModel.downloadUrl, selectedModel.name);
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 当模式改变时重新加载数据
  useEffect(() => {
    if (open && mode === 'platform') {
      loadModels(1, searchText);
    }
  }, [open, mode]);

  // 关闭时取消上传
  useEffect(() => {
    if (!open && uploading) {
      handleCancelUpload();
    }
  }, [open]);

  return (
    <Modal
      title="选择模型"
      open={open}
      onCancel={onCancel}
      width={800}
      maskClosable={!uploading}
      closable={!uploading}
      footer={
        mode === 'platform' ? (
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button 
              type="primary" 
              disabled={!selectedModel}
              onClick={handleSelectModel}
            >
              选择模型
            </Button>
          </Space>
        ) : null
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Radio.Group 
          value={mode} 
          onChange={(e) => {
            setMode(e.target.value);
            setSelectedModel(null);
          }}
          disabled={uploading}
          style={{ width: '100%' }}
        >
          <Radio.Button value="platform" style={{ width: '50%', textAlign: 'center' }}>
            <GlobalOutlined /> 选择平台资源
          </Radio.Button>
          <Radio.Button value="upload" style={{ width: '50%', textAlign: 'center' }}>
            <CloudUploadOutlined /> 本地上传
          </Radio.Button>
        </Radio.Group>
      </div>

      {mode === 'platform' ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Input.Search
              placeholder="搜索模型文件名..."
              allowClear
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </div>
          
          <Spin spinning={loading}>
            {models.length > 0 ? (
              <>
                <List
                  itemLayout="horizontal"
                  dataSource={models}
                  style={{ minHeight: 300, maxHeight: 400, overflowY: 'auto' }}
                  renderItem={(item) => (
                    <List.Item
                      style={{
                        cursor: 'pointer',
                        padding: '16px',
                        border: selectedModel?.id === item.id ? '2px solid #1890ff' : '1px solid #d9d9d9',
                        borderRadius: 6,
                        marginBottom: 8,
                        backgroundColor: selectedModel?.id === item.id ? '#1a3a5c' : '#2a4b6b',
                        transition: 'all 0.3s',
                      }}
                      onClick={() => setSelectedModel(item)}
                      onMouseEnter={(e) => {
                        if (selectedModel?.id !== item.id) {
                          e.currentTarget.style.backgroundColor = '#1a3a5c';
                          e.currentTarget.style.borderColor = '#40a9ff';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedModel?.id !== item.id) {
                          e.currentTarget.style.backgroundColor = '#2a4b6b';
                          e.currentTarget.style.borderColor = '#d9d9d9';
                        }
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            shape="square"
                            size={48}
                            icon={<FileOutlined />}
                            style={{ 
                              backgroundColor: item.type === 'public' ? '#52c41a' : '#1890ff' 
                            }}
                          />
                        }
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{item.name}</span>
                            <Badge
                              count={item.type === 'public' ? '公共' : '个人'}
                              style={{
                                backgroundColor: item.type === 'public' ? '#52c41a' : '#1890ff',
                              }}
                            />
                          </div>
                        }
                        description={
                          <div>
                            <div>大小: {formatFileSize(item.size)}</div>
                            <div>创建时间: {new Date(item.createdAt).toLocaleString()}</div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
                
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Pagination
                    current={pagination.page}
                    total={pagination.total}
                    pageSize={pagination.limit}
                    onChange={handlePageChange}
                    showSizeChanger={false}
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 个模型`}
                  />
                </div>
              </>
            ) : (
              <Empty 
                description="暂无可用模型"
                style={{ margin: '60px 0' }}
              />
            )}
          </Spin>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          {!uploading ? (
            <Upload.Dragger {...uploadProps} style={{ width: '100%' }}>
              <div style={{ padding: '20px 0' }}>
                <InboxOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <div style={{ marginTop: 16, fontSize: 16 }}>
                  点击或拖拽文件到此区域上传
                </div>
                <div style={{ marginTop: 8, color: '#999' }}>
                  支持 GLB、FBX、OBJ、STL 格式，单个文件不超过 500MB
                </div>
                <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
                  大文件将自动分块上传，支持断点续传
                </div>
              </div>
            </Upload.Dragger>
          ) : (
            <div style={{ padding: '40px 20px' }}>
              <Progress 
                percent={uploadProgress} 
                status={uploadProgress === 100 ? 'success' : 'active'}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <div style={{ marginTop: 16, color: '#999' }}>
                {uploadStatus}
              </div>
              <Button 
                danger 
                style={{ marginTop: 16 }}
                onClick={handleCancelUpload}
              >
                取消上传
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
