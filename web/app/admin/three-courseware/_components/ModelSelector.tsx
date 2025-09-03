"use client";
import React, { useState, useEffect } from 'react';
import { Modal, Radio, List, Avatar, Upload, Button, Input, Space, App, Spin, Empty, Pagination, Badge } from 'antd';
import { InboxOutlined, CloudUploadOutlined, FileOutlined, GlobalOutlined, UserOutlined } from '@ant-design/icons';
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

export default function ModelSelector({ open, onCancel, onSelect }: ModelSelectorProps) {
  const [mode, setMode] = useState<'platform' | 'upload'>('platform');
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [selectedModel, setSelectedModel] = useState<ModelItem | null>(null);
  const { message } = App.useApp();

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

  // 上传配置
  const uploadProps: UploadProps = {
    name: 'file',
    action: '/api/files/upload',
    headers: {
      Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
    },
    accept: '.glb,.fbx,.obj,.stl',
    showUploadList: false,
    beforeUpload: (file) => {
      const isModel = ['.glb', '.fbx', '.obj', '.stl'].some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      if (!isModel) {
        message.error('只支持 GLB、FBX、OBJ、STL 格式的模型文件');
        return false;
      }
      const isLt100M = file.size / 1024 / 1024 < 100;
      if (!isLt100M) {
        message.error('模型文件大小不能超过 100MB');
        return false;
      }
      return true;
    },
    onChange: async (info) => {
      if (info.file.status === 'uploading') {
        setUploading(true);
      } else if (info.file.status === 'done') {
        setUploading(false);
        const response = info.file.response;
        if (response?.ok && response?.downloadUrl) {
          message.success('模型上传成功');
          onSelect(response.downloadUrl, info.file.name);
        } else {
          message.error('上传失败');
        }
      } else if (info.file.status === 'error') {
        setUploading(false);
        message.error(`上传失败: ${info.file.response?.message || '未知错误'}`);
      }
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

  return (
    <Modal
      title="选择模型"
      open={open}
      onCancel={onCancel}
      width={800}
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
          <Upload.Dragger {...uploadProps} style={{ width: '100%' }}>
            <div style={{ padding: '20px 0' }}>
              <InboxOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <div style={{ marginTop: 16, fontSize: 16 }}>
                {uploading ? '正在上传...' : '点击或拖拽文件到此区域上传'}
              </div>
              <div style={{ marginTop: 8, color: '#999' }}>
                支持 GLB、FBX、OBJ、STL 格式，单个文件不超过 100MB
              </div>
            </div>
          </Upload.Dragger>
          
          {uploading && (
            <div style={{ marginTop: 16 }}>
              <Spin /> <span style={{ marginLeft: 8 }}>文件上传中，请稍候...</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
