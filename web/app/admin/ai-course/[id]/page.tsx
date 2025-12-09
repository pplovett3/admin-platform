"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Form, Input, Space, message, Layout, Badge } from 'antd';
import { GlobalOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { authFetch } from '@/app/_lib/api';
import OutlineEditor from './components/OutlineEditor';
import PropertyPanel from './components/PropertyPanel';
import CoursewareViewer from './components/CoursewareViewer';
import CoursePreviewPlayer from './components/CoursePreviewPlayer';
import PublishDialog from './components/PublishDialog';
import QuestionEditor from './components/QuestionEditor';

const { Sider, Content } = Layout;

export default function EditAICoursePage() {
  const params = useParams();
  const id = params?.id as string;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form] = Form.useForm();
  const [courseData, setCourseData] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [publishDialogVisible, setPublishDialogVisible] = useState(false);
  const [questionEditorVisible, setQuestionEditorVisible] = useState(false);
  const [coursewareAnnotations, setCoursewareAnnotations] = useState<any[]>([]);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await authFetch<any>(`/api/ai-courses/${id}`);
      form.setFieldsValue(res);
      setCourseData(res);
      
      // 加载关联课件的标注列表（用于考题编辑器）
      if (res.coursewareId) {
        try {
          const courseware = await authFetch<any>(`/api/coursewares/${res.coursewareId}`);
          setCoursewareAnnotations(courseware.annotations || []);
        } catch (e) {
          console.warn('加载课件标注失败', e);
        }
      }
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const updated = { 
        ...values, 
        outline: courseData?.outline || [],
        questions: courseData?.questions || []
      };
      await authFetch(`/api/ai-courses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      message.success('保存成功');
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验错误
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  // 考题变更处理
  const onQuestionsChange = (newQuestions: any[]) => {
    setCourseData({ ...courseData, questions: newQuestions });
  };

  async function onGenerateAI() {
    if (!courseData?.coursewareId) {
      message.error('请先保存基础信息');
      return;
    }
    
    setGenerating(true);
    try {
      const values = await form.validateFields(['theme', 'audience', 'durationTarget']);
      const res = await authFetch<any>('/api/ai/generate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coursewareId: courseData.coursewareId,
          theme: values.theme || '设备结构介绍',
          audience: values.audience || '初学者',
          durationTarget: values.durationTarget || 10
        })
      });
      
      // 更新课程数据
      setCourseData({ ...courseData, outline: res.outline });
      message.success('AI生成成功！已生成课程大纲');
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || 'AI生成失败');
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  // 添加全局样式以禁用文字选择，但保留输入框等交互元素的选择功能
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .ai-course-editor-page * {
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }
      .ai-course-editor-page input,
      .ai-course-editor-page textarea,
      .ai-course-editor-page [contenteditable="true"],
      .ai-course-editor-page .ant-input,
      .ai-course-editor-page .ant-input-number-input {
        user-select: text !important;
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const onOutlineChange = (newOutline: any[]) => {
    setCourseData({ ...courseData, outline: newOutline });
  };

  const onItemChange = (updatedItem: any) => {
    if (!courseData?.outline || !selectedItem) return;
    
    // 找到并更新对应的 item
    const newOutline = [...courseData.outline];
    let found = false;
    
    for (let segIndex = 0; segIndex < newOutline.length; segIndex++) {
      const segment = newOutline[segIndex];
      if (segment.items) {
        for (let itemIndex = 0; itemIndex < segment.items.length; itemIndex++) {
          if (segment.items[itemIndex].id === selectedItem.id) {
            newOutline[segIndex].items[itemIndex] = updatedItem;
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }
    
    setCourseData({ ...courseData, outline: newOutline });
    setSelectedItem(updatedItem);
  };

  return (
    <div className="ai-course-editor-page" style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      background: 'var(--color-bg-container)'
    }}>
      {/* 顶部工具栏 */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-container)' }}>
        <Space>
          <Button onClick={load} loading={loading}>刷新</Button>
          <Button type="primary" onClick={onSave} loading={saving}>保存</Button>
          <Button onClick={onGenerateAI} loading={generating} style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}>
            AI生成初稿
          </Button>
          <Button 
            type="primary" 
            onClick={() => setPreviewVisible(true)}
            disabled={!courseData?.outline || courseData.outline.length === 0}
            style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
          >
            预览播放
          </Button>
          <Badge count={courseData?.questions?.length || 0} size="small" offset={[-5, 0]}>
            <Button 
              icon={<QuestionCircleOutlined />}
              onClick={() => setQuestionEditorVisible(true)}
              disabled={!courseData?.outline || courseData.outline.length === 0}
              style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16', color: 'white' }}
            >
              考题管理
            </Button>
          </Badge>
          <Button 
            type="primary" 
            icon={<GlobalOutlined />}
            onClick={() => setPublishDialogVisible(true)}
            disabled={!courseData?.outline || courseData.outline.length === 0}
            style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
          >
            发布分享
          </Button>
        </Space>
      </div>

      {/* 基础信息表单 */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-container)' }}>
        <Form layout="inline" form={form} size="small">
          <Form.Item label="课程名称" name="title" rules={[{ required: true }]}>
            <Input style={{ width: 200 }} />
          </Form.Item>
          <Form.Item label="课程主题" name="theme">
            <Input style={{ width: 150 }} />
          </Form.Item>
          <Form.Item label="受众" name="audience">
            <Input style={{ width: 120 }} />
          </Form.Item>
          <Form.Item label="时长(分钟)" name="durationTarget">
            <Input type="number" style={{ width: 80 }} />
          </Form.Item>
          <Form.Item label="语言" name="language">
            <Input placeholder="zh-CN" style={{ width: 80 }} />
          </Form.Item>
        </Form>
      </div>

      {/* 三栏布局 */}
      <Layout style={{ flex: 1 }}>
        {/* 左侧：段落树 */}
        <Sider width={350} style={{ background: 'var(--color-bg-container)', borderRight: '1px solid var(--color-border)' }}>
          <div style={{ padding: '16px 0', borderBottom: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: 0, paddingLeft: 16, fontSize: 14, fontWeight: 'bold' }}>课程大纲</h4>
          </div>
          <OutlineEditor
            outline={courseData?.outline || []}
            onChange={onOutlineChange}
            onSelectItem={setSelectedItem}
          />
        </Sider>

        {/* 中间：三维视窗 */}
        <Content style={{ background: 'var(--color-bg-container)', position: 'relative' }}>
          <div style={{ padding: '16px 0', borderBottom: '1px solid var(--color-border)', paddingLeft: 16 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 'bold' }}>三维预览</h4>
          </div>
          <div style={{ height: 'calc(100% - 57px)' }}>
            <CoursewareViewer
              coursewareId={courseData?.coursewareId || ''}
              selectedItem={selectedItem}
            />
          </div>
        </Content>

        {/* 右侧：属性面板 */}
        <Sider width={400} style={{ background: 'var(--color-bg-container)', borderLeft: '1px solid var(--color-border)' }}>
          <div style={{ padding: '16px 0', borderBottom: '1px solid var(--color-border)', paddingLeft: 16 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 'bold' }}>属性编辑</h4>
          </div>
          <div style={{ height: 'calc(100% - 57px)' }}>
            <PropertyPanel
              selectedItem={selectedItem}
              onItemChange={onItemChange}
              coursewareId={courseData?.coursewareId}
            />
          </div>
        </Sider>
      </Layout>

      {/* 预览播放器 */}
      <CoursePreviewPlayer
        courseData={courseData}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
      />

      {/* 发布对话框 */}
      <PublishDialog
        courseId={id}
        visible={publishDialogVisible}
        onClose={() => setPublishDialogVisible(false)}
        onPublished={(publishData) => {
          message.success('发布成功！');
          // 可以在这里更新UI状态或刷新数据
        }}
      />

      {/* 考题编辑器 */}
      <QuestionEditor
        courseId={id}
        questions={courseData?.questions || []}
        onChange={onQuestionsChange}
        annotations={coursewareAnnotations}
        visible={questionEditorVisible}
        onClose={() => setQuestionEditorVisible(false)}
      />
    </div>
  );
}



