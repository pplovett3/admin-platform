"use client";
import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  App,
  Tag,
  Drawer,
  Descriptions,
  Typography
} from 'antd';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/app/_utils/api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Title, Text } = Typography;

export default function ActivationCodesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const result = await apiGet<any>('/api/activation-codes');
      setData(result.items || []);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const list = await apiGet<any[]>('/api/courses');
      setCourses(Array.isArray(list) ? list : []);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  useEffect(() => {
    load();
    loadCourses();
  }, []);

  const cols = useMemo(() => [
    {
      title: '激活码',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Text copyable strong>{text}</Text>
    },
    {
      title: '课程',
      dataIndex: 'courseId',
      key: 'courseId',
      render: (course: any) => course?.name || '-'
    },
    {
      title: '使用情况',
      key: 'usage',
      render: (_: any, record: any) => (
        <span>{record.usedCount} / {record.maxUses}</span>
      )
    },
    {
      title: '有效期',
      key: 'validity',
      render: (_: any, record: any) => (
        <span>
          {dayjs(record.validFrom).format('YYYY-MM-DD')} 至 {dayjs(record.validUntil).format('YYYY-MM-DD')}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" onClick={() => viewDetail(record.code)}>详情</Button>
          <Button
            size="small"
            onClick={() => toggleStatus(record)}
          >
            {record.status === 'active' ? '禁用' : '启用'}
          </Button>
          <Button
            size="small"
            danger
            onClick={() => onDelete(record.code)}
            disabled={record.usedCount > 0}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ], []);

  const viewDetail = async (code: string) => {
    try {
      const detail = await apiGet<any>(`/api/activation-codes/${code}`);
      setSelectedCode(detail);
      setDetailOpen(true);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const toggleStatus = async (record: any) => {
    const newStatus = record.status === 'active' ? 'disabled' : 'active';
    Modal.confirm({
      title: `确认${newStatus === 'active' ? '启用' : '禁用'}该激活码？`,
      onOk: async () => {
        try {
          await apiPatch(`/api/activation-codes/${record.code}`, { status: newStatus });
          message.success('操作成功');
          load();
        } catch (e: any) {
          message.error(e.message);
        }
      }
    });
  };

  const onDelete = (code: string) => {
    Modal.confirm({
      title: '确认删除该激活码？',
      content: '删除后无法恢复',
      onOk: async () => {
        try {
          await apiDelete(`/api/activation-codes/${code}`);
          message.success('已删除');
          load();
        } catch (e: any) {
          message.error(e.message);
        }
      }
    });
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const payload = {
        courseId: values.courseId,
        count: values.count,
        maxUses: values.maxUses,
        validFrom: values.validFrom ? dayjs(values.validFrom).toISOString() : undefined,
        validUntil: dayjs(values.validUntil).toISOString(),
        description: values.description
      };

      const result = await apiPost<any>('/api/activation-codes', payload);
      message.success(`成功生成${result.count}个激活码`);
      
      // 显示生成的激活码
      Modal.info({
        title: '激活码已生成',
        width: 600,
        content: (
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            <p>共生成 {result.codes.length} 个激活码：</p>
            {result.codes.map((code: any, index: number) => (
              <div key={index} style={{ marginBottom: 8 }}>
                <Text copyable>{code.code}</Text>
              </div>
            ))}
          </div>
        )
      });

      setOpen(false);
      form.resetFields();
      load();
    } catch (e: any) {
      if (e.errorFields) {
        message.error('请检查表单输入');
      } else {
        message.error(e.message || '生成失败');
      }
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>激活码管理</Title>
          <Button
            type="primary"
            onClick={() => {
              form.resetFields();
              // 设置默认值
              form.setFieldsValue({
                count: 1,
                maxUses: 30,
                validFrom: dayjs(),
                validUntil: dayjs().add(1, 'year')
              });
              setOpen(true);
            }}
          >
            生成激活码
          </Button>
        </div>

        <Table
          columns={cols}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Space>

      {/* 生成激活码对话框 */}
      <Modal
        title="生成激活码"
        open={open}
        onOk={onSubmit}
        onCancel={() => {
          setOpen(false);
          form.resetFields();
        }}
        width={600}
        okText="生成"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label="选择课程"
            name="courseId"
            rules={[{ required: true, message: '请选择课程' }]}
          >
            <Select
              placeholder="请选择课程"
              options={courses.map(c => ({ label: c.name, value: c._id }))}
            />
          </Form.Item>

          <Form.Item
            label="生成数量"
            name="count"
            rules={[
              { required: true, message: '请输入生成数量' },
              { type: 'number', min: 1, max: 100, message: '数量范围：1-100' }
            ]}
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="每个激活码可激活人数"
            name="maxUses"
            rules={[
              { required: true, message: '请输入可激活人数' },
              { type: 'number', min: 1, message: '至少1人' }
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="例如：30（一个班级）" />
          </Form.Item>

          <Form.Item
            label="生效时间"
            name="validFrom"
            rules={[{ required: true, message: '请选择生效时间' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="过期时间"
            name="validUntil"
            rules={[{ required: true, message: '请选择过期时间' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="备注"
            name="description"
          >
            <TextArea rows={3} placeholder="例如：2024春季班" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 激活码详情抽屉 */}
      <Drawer
        title="激活码详情"
        placement="right"
        width={600}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedCode(null);
        }}
      >
        {selectedCode && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="激活码">
                <Text copyable strong>{selectedCode.code}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="课程">
                {selectedCode.courseId?.name}
              </Descriptions.Item>
              <Descriptions.Item label="使用情况">
                {selectedCode.usedCount} / {selectedCode.maxUses}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedCode.status === 'active' ? 'green' : 'red'}>
                  {selectedCode.status === 'active' ? '启用' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="有效期">
                {dayjs(selectedCode.validFrom).format('YYYY-MM-DD')} 至{' '}
                {dayjs(selectedCode.validUntil).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="备注">
                {selectedCode.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {selectedCode.createdBy?.name}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedCode.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={5}>使用该激活码的用户（{selectedCode.activations?.length || 0}）</Title>
              <Table
                dataSource={selectedCode.activations || []}
                rowKey="userId"
                pagination={false}
                size="small"
                columns={[
                  { title: '姓名', dataIndex: 'userName' },
                  { title: '学号', dataIndex: 'studentId' },
                  { title: '手机号', dataIndex: 'userPhone' },
                  {
                    title: '激活时间',
                    dataIndex: 'activatedAt',
                    render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: (status: string) => (
                      <Tag color={status === 'active' ? 'green' : status === 'expired' ? 'orange' : 'red'}>
                        {status === 'active' ? '激活' : status === 'expired' ? '过期' : '已撤销'}
                      </Tag>
                    )
                  }
                ]}
              />
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
}

