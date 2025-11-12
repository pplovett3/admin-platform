import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Typography, message, Spin, Avatar, Space, Tag, Modal, Form, Input } from 'antd';
import { LogoutOutlined, PlayCircleOutlined, ClockCircleOutlined, KeyOutlined } from '@ant-design/icons';
import { getAllCourses, getUserActivations, verifyCourseAccess, getCurrentUser, clearToken, activateCourse } from '../utils/api';
import { UserCourseActivation } from '../../shared/types';

const { Title, Text } = Typography;

interface CourseListProps {
  onLogout: () => void;
}

interface CourseWithActivation {
  _id: string;
  name: string;
  description?: string;
  code?: string;
  activation?: {
    activatedAt: string;
    expiresAt?: string;
    status: string;
  };
}

export const CourseList: React.FC<CourseListProps> = ({ onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseWithActivation[]>([]);
  const [launchingCourse, setLaunchingCourse] = useState<string | null>(null);
  const [activateModalVisible, setActivateModalVisible] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithActivation | null>(null);
  const [activating, setActivating] = useState(false);
  const [form] = Form.useForm();
  const user = getCurrentUser();

  useEffect(() => {
    loadCoursesAndActivations();
  }, []);

  const loadCoursesAndActivations = async () => {
    setLoading(true);
    try {
      // 并行加载课程列表和激活记录
      const [allCourses, activations] = await Promise.all([
        getAllCourses(),
        getUserActivations()
      ]);

      // 合并数据：将激活信息附加到课程上
      const coursesWithActivation = allCourses.map(course => {
        const activation = activations.find((a: any) => a.courseId === course._id && a.status === 'active');
        return {
          ...course,
          activation: activation ? {
            activatedAt: activation.activatedAt,
            expiresAt: activation.expiresAt,
            status: activation.status
          } : undefined
        };
      });

      setCourses(coursesWithActivation);
    } catch (error: any) {
      message.error(error.message || '加载课程列表失败');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchCourse = async (course: CourseWithActivation) => {
    setLaunchingCourse(course._id);
    try {
      // 验证访问权限
      const verifyResult = await verifyCourseAccess(course._id);
      
      if (!verifyResult.allowed) {
        message.error(verifyResult.message || '无权访问此课程');
        return;
      }

      // 获取token
      const token = localStorage.getItem('token');
      if (!token) {
        message.error('未找到认证令牌，请重新登录');
        return;
      }

      // 调用Electron API启动应用
      const result = await window.electronAPI.launchApp(course._id, token);
      
      if (result.success) {
        message.success('课程已启动！');
      } else {
        message.error(result.error || '启动课程失败');
      }
    } catch (error: any) {
      message.error(error.message || '启动课程失败');
    } finally {
      setLaunchingCourse(null);
    }
  };

  const handleActivateClick = (course: CourseWithActivation) => {
    setSelectedCourse(course);
    setActivateModalVisible(true);
    form.resetFields();
  };

  const handleActivateSubmit = async () => {
    try {
      const values = await form.validateFields();
      setActivating(true);

      const result = await activateCourse(values.code.trim(), selectedCourse!._id);
      
      message.success(result.message || '激活成功！');
      setActivateModalVisible(false);
      form.resetFields();
      
      // 重新加载课程列表
      await loadCoursesAndActivations();
    } catch (error: any) {
      message.error(error.message || '激活失败');
    } finally {
      setActivating(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    message.info('已退出登录');
    onLogout();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '永久';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  const isExpired = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      padding: '24px'
    }}>
      {/* 顶部栏 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="large">
            <Avatar size={48} style={{ backgroundColor: '#667eea' }}>
              {user?.name?.[0] || 'U'}
            </Avatar>
            <div>
              <Title level={4} style={{ margin: 0 }}>{user?.name || '用户'}</Title>
              <Text type="secondary">{user?.phone || ''}</Text>
            </div>
          </Space>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </Card>

      {/* 课程列表 */}
      <Title level={3} style={{ marginBottom: 24 }}>全部课程</Title>
      
      {courses.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Text type="secondary" style={{ fontSize: 16 }}>
              暂无可用课程
            </Text>
          </div>
        </Card>
      ) : (
        <Row gutter={[24, 24]}>
          {courses.map((course) => {
            const isActivated = !!course.activation;
            const expired = isActivated && isExpired(course.activation?.expiresAt);
            
            return (
              <Col xs={24} sm={12} md={8} key={course._id}>
                <Card
                  hoverable
                  cover={
                    <div style={{
                      height: 180,
                      background: isActivated 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'linear-gradient(135deg, #a8b8d8 0%, #c3cfe2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
                      {isActivated ? (
                        <PlayCircleOutlined style={{ fontSize: 64, color: 'white' }} />
                      ) : (
                        <KeyOutlined style={{ fontSize: 64, color: 'white' }} />
                      )}
                      {isActivated && (
                        <Tag 
                          color="success" 
                          style={{ 
                            position: 'absolute', 
                            top: 12, 
                            right: 12 
                          }}
                        >
                          已激活
                        </Tag>
                      )}
                    </div>
                  }
                  actions={[
                    isActivated ? (
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        loading={launchingCourse === course._id}
                        disabled={expired}
                        onClick={() => handleLaunchCourse(course)}
                        block
                      >
                        启动课程
                      </Button>
                    ) : (
                      <Button
                        icon={<KeyOutlined />}
                        onClick={() => handleActivateClick(course)}
                        block
                      >
                        激活课程
                      </Button>
                    )
                  ]}
                >
                  <Card.Meta
                    title={course.name}
                    description={
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {course.description && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {course.description}
                          </Text>
                        )}
                        {isActivated && (
                          <div>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              有效期至：{formatDate(course.activation?.expiresAt)}
                            </Text>
                          </div>
                        )}
                        {expired && (
                          <Tag color="error">已过期</Tag>
                        )}
                      </Space>
                    }
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* 激活课程Modal */}
      <Modal
        title={`激活课程：${selectedCourse?.name}`}
        open={activateModalVisible}
        onOk={handleActivateSubmit}
        onCancel={() => {
          setActivateModalVisible(false);
          form.resetFields();
        }}
        okText="激活"
        cancelText="取消"
        confirmLoading={activating}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            label="激活码"
            name="code"
            rules={[
              { required: true, message: '请输入激活码' },
              { 
                pattern: /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 
                message: '激活码格式不正确（格式：XXXX-XXXX-XXXX）' 
              }
            ]}
          >
            <Input
              placeholder="XXXX-XXXX-XXXX"
              size="large"
              prefix={<KeyOutlined />}
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                form.setFieldsValue({ code: value });
              }}
            />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            请输入您获得的激活码。激活码格式为：XXXX-XXXX-XXXX
          </Text>
        </Form>
      </Modal>
    </div>
  );
};

