"use client";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, Form, Input, Button, App, Space, Typography, Alert } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { apiPost } from '@/app/_utils/api';
import ModelSelector from '../_components/ModelSelector';

export default function ThreeCoursewareCreatePage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [selectedModelUrl, setSelectedModelUrl] = useState<string>('');
  const [selectedModelName, setSelectedModelName] = useState<string>('');

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      
      if (!selectedModelUrl) {
        message.error('请选择模型文件');
        return;
      }
      
      setSubmitting(true);
      const coursewareData = {
        ...v,
        modelUrl: selectedModelUrl
      };
      
      const created: any = await apiPost('/api/coursewares', coursewareData);
      message.success('课件创建成功');
      router.push(`/admin/three-courseware/${created._id}`);
    } catch (e: any) { 
      message.error(e?.message || '创建失败'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleModelSelect = (modelUrl: string, modelName: string) => {
    setSelectedModelUrl(modelUrl);
    setSelectedModelName(modelName);
    setModelSelectorOpen(false);
    message.success(`已选择模型: ${modelName}`);
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>新建三维课件</Typography.Title>
      </Space>
      <Card>
        <Form layout="vertical" form={form} style={{ maxWidth: 600 }}>
          <Form.Item name="name" label="课件名称" rules={[{ required: true, message: '请输入课件名称' }]}>
            <Input placeholder="例如：汽车结构讲解"/>
          </Form.Item>
          <Form.Item name="description" label="课件描述">
            <Input.TextArea rows={3} placeholder="简要描述课件内容和用途"/>
          </Form.Item>
          
          <Form.Item label="模型文件" required>
            <div style={{ marginBottom: 8 }}>
              <Button 
                icon={<FolderOpenOutlined />} 
                onClick={() => setModelSelectorOpen(true)}
                style={{ width: '100%' }}
              >
                {selectedModelName ? `已选择: ${selectedModelName}` : '选择模型文件'}
              </Button>
            </div>
            {selectedModelName && (
              <Alert
                message={`模型文件: ${selectedModelName}`}
                type="success"
                showIcon
                closable
                onClose={() => {
                  setSelectedModelUrl('');
                  setSelectedModelName('');
                }}
                style={{ marginTop: 8 }}
              />
            )}
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                loading={submitting} 
                onClick={onSubmit}
                disabled={!selectedModelUrl}
              >
                创建课件
              </Button>
              <Button onClick={() => router.back()}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
        
        <ModelSelector
          open={modelSelectorOpen}
          onCancel={() => setModelSelectorOpen(false)}
          onSelect={handleModelSelect}
        />
      </Card>
    </div>
  );
}


