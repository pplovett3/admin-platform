"use client";
import { useState, useEffect } from 'react';
import { Modal, Form, Switch, Input, Button, Space, message, Typography, Alert, Select } from 'antd';
import { ShareAltOutlined, CopyOutlined, GlobalOutlined } from '@ant-design/icons';
import { authFetch } from '@/app/_lib/api';

const { Text, Link } = Typography;

interface PublishDialogProps {
  courseId: string;
  visible: boolean;
  onClose: () => void;
  onPublished?: (publishData: any) => void;
}

interface PublishConfig {
  isPublic: boolean;
  allowDownload: boolean;
  showAuthor: boolean;
  enableComments: boolean;
  autoPlay: boolean;
  watermark?: string;
}

interface PublishStatus {
  isPublished: boolean;
  publishId?: string;
  shareUrl?: string;
  status?: string;
  publishConfig?: PublishConfig;
  stats?: {
    viewCount: number;
    shareCount: number;
  };
  publishedAt?: string;
  lastUpdated?: string;
}

export default function PublishDialog({ courseId, visible, onClose, onPublished }: PublishDialogProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [publishStatus, setPublishStatus] = useState<PublishStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [enableTTS, setEnableTTS] = useState(false);
  const [ttsProviders, setTTSProviders] = useState<any[]>([]);

  // 获取发布状态
  const checkPublishStatus = async () => {
    if (!courseId) return;
    
    setChecking(true);
    try {
      const response = await authFetch<PublishStatus>(`/api/ai-courses/${courseId}/publish`);
      setPublishStatus(response);
      
      // 如果已发布，设置表单值
      if (response.isPublished && response.publishConfig) {
        form.setFieldsValue(response.publishConfig);
      }
    } catch (error: any) {
      console.error('检查发布状态失败:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (visible) {
      checkPublishStatus();
      loadTTSProviders();
    }
  }, [visible, courseId]);

  // 加载TTS供应商列表
  const loadTTSProviders = async () => {
    try {
      const response = await authFetch<any>('/api/ai/tts/providers');
      setTTSProviders(response.providers || []);
    } catch (error) {
      console.error('加载TTS供应商失败:', error);
    }
  };

  // 发布课程
  const handlePublish = async (values: any) => {
    setLoading(true);
    try {
      const { ttsProvider, ttsVoice, ...publishConfig } = values;
      
      // 构建请求体
      const requestBody: any = { publishConfig };
      
      // 如果启用了TTS，添加TTS配置
      if (enableTTS && ttsProvider && ttsVoice) {
        const provider = ttsProviders.find(p => p.id === ttsProvider);
        const voice = provider?.voices?.find((v: any) => v.id === ttsVoice);
        
        if (provider && voice) {
          requestBody.ttsConfig = {
            provider: ttsProvider,
            ...(ttsProvider === 'azure' ? {
              voiceName: voice.id,
              language: voice.locale || 'zh-CN'
            } : {
              voice_id: voice.id,
              speed: 1.0
            })
          };
        }
      }
      
      const response = await authFetch(`/api/ai-courses/${courseId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      message.success(publishStatus?.isPublished ? '发布配置已更新' : '课程发布成功！');
      
      // 重新获取状态
      await checkPublishStatus();
      
      if (onPublished) {
        onPublished(response);
      }
    } catch (error: any) {
      message.error(error.message || '发布失败');
    } finally {
      setLoading(false);
    }
  };

  // 停用发布
  const handleUnpublish = async () => {
    setLoading(true);
    try {
      await authFetch(`/api/ai-courses/${courseId}/publish`, {
        method: 'DELETE'
      });

      message.success('课程已停用发布');
      
      // 重新获取状态
      await checkPublishStatus();
    } catch (error: any) {
      message.error(error.message || '停用失败');
    } finally {
      setLoading(false);
    }
  };

  // 复制分享链接
  const copyShareUrl = async () => {
    if (!publishStatus?.shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(publishStatus.shareUrl);
      message.success('分享链接已复制到剪贴板');
    } catch (error) {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = publishStatus.shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success('分享链接已复制到剪贴板');
    }
  };

  // 增加分享计数
  const handleShare = async () => {
    await copyShareUrl();
    // TODO: 调用API增加分享计数
  };

  return (
    <Modal
      title={
        <Space>
          <GlobalOutlined />
          {publishStatus?.isPublished ? '管理发布' : '发布课程'}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={600}
      footer={null}
    >
      <div style={{ marginBottom: 16 }}>
        {checking ? (
          <Alert message="正在检查发布状态..." type="info" showIcon />
        ) : publishStatus?.isPublished ? (
          <Alert
            message="课程已发布"
            description={
              <div>
                <div>发布时间：{publishStatus.publishedAt ? new Date(publishStatus.publishedAt).toLocaleString() : ''}</div>
                <div>访问次数：{publishStatus.stats?.viewCount || 0}</div>
                <div style={{ marginTop: 8 }}>
                  <Space>
                    <Link href={publishStatus.shareUrl} target="_blank">
                      <GlobalOutlined /> 查看公开页面
                    </Link>
                    <Button 
                      type="link" 
                      icon={<CopyOutlined />} 
                      onClick={copyShareUrl}
                      style={{ padding: 0 }}
                    >
                      复制链接
                    </Button>
                    <Button 
                      type="link" 
                      icon={<ShareAltOutlined />} 
                      onClick={handleShare}
                      style={{ padding: 0 }}
                    >
                      分享
                    </Button>
                  </Space>
                </div>
              </div>
            }
            type="success"
            showIcon
          />
        ) : (
          <Alert
            message="课程尚未发布"
            description="发布后，任何人都可以通过分享链接观看您的AI课程"
            type="info"
            showIcon
          />
        )}
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handlePublish}
        initialValues={{
          isPublic: true,
          allowDownload: false,
          showAuthor: true,
          enableComments: false,
          autoPlay: true
        }}
      >
        <Form.Item 
          name="isPublic" 
          label="公开访问"
          valuePropName="checked"
        >
          <Switch 
            checkedChildren="公开" 
            unCheckedChildren="私有"
            disabled // 目前只支持完全公开
          />
        </Form.Item>

        <Form.Item 
          name="allowDownload" 
          label="允许下载"
          valuePropName="checked"
        >
          <Switch 
            checkedChildren="允许" 
            unCheckedChildren="禁止"
            disabled // TODO: 后续实现
          />
        </Form.Item>

        <Form.Item 
          name="showAuthor" 
          label="显示作者信息"
          valuePropName="checked"
        >
          <Switch 
            checkedChildren="显示" 
            unCheckedChildren="隐藏"
          />
        </Form.Item>

        <Form.Item 
          name="enableComments" 
          label="启用评论"
          valuePropName="checked"
        >
          <Switch 
            checkedChildren="启用" 
            unCheckedChildren="禁用"
            disabled // TODO: 后续实现
          />
        </Form.Item>

        <Form.Item 
          name="autoPlay" 
          label="自动播放"
          valuePropName="checked"
        >
          <Switch 
            checkedChildren="自动" 
            unCheckedChildren="手动"
          />
        </Form.Item>

        <Form.Item 
          name="watermark" 
          label="水印文字（可选）"
        >
          <Input 
            placeholder="输入水印文字"
            maxLength={20}
            disabled // TODO: 后续实现
          />
        </Form.Item>

        <Form.Item 
          label="生成配音文件"
        >
          <Switch 
            checked={enableTTS}
            onChange={setEnableTTS}
            checkedChildren="启用" 
            unCheckedChildren="禁用"
          />
          <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
            启用后将为课程生成配音文件并保存到NAS，确保播放稳定性
          </div>
        </Form.Item>

        {enableTTS && (
          <>
            <Form.Item 
              name="ttsProvider" 
              label="TTS供应商"
              rules={[{ required: enableTTS, message: '请选择TTS供应商' }]}
            >
              <Select placeholder="选择TTS供应商">
                {ttsProviders.map(provider => (
                  <Select.Option key={provider.id} value={provider.id}>
                    {provider.name} - {provider.description}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item 
              name="ttsVoice" 
              label="音色选择"
              rules={[{ required: enableTTS, message: '请选择音色' }]}
            >
              <Select 
                placeholder="选择音色"
                disabled={!form.getFieldValue('ttsProvider')}
              >
                {(() => {
                  const selectedProvider = ttsProviders.find(p => p.id === form.getFieldValue('ttsProvider'));
                  return selectedProvider?.voices?.map((voice: any) => (
                    <Select.Option key={voice.id} value={voice.id}>
                      {voice.name} ({voice.gender || voice.locale})
                    </Select.Option>
                  )) || [];
                })()}
              </Select>
            </Form.Item>
          </>
        )}

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Space>
            <Button onClick={onClose}>
              取消
            </Button>
            {publishStatus?.isPublished && (
              <Button 
                danger 
                onClick={handleUnpublish} 
                loading={loading}
              >
                停用发布
              </Button>
            )}
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<GlobalOutlined />}
            >
              {publishStatus?.isPublished ? '更新配置' : '立即发布'}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
}
