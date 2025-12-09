"use client";
import { useState, useEffect } from 'react';
import { 
  Modal, Button, Form, Input, Select, Radio, Space, Card, Tag, 
  InputNumber, Slider, message, Popconfirm, Empty, Spin, Collapse,
  Tooltip
} from 'antd';
import { 
  PlusOutlined, DeleteOutlined, EditOutlined, RobotOutlined,
  QuestionCircleOutlined, EyeOutlined, CheckCircleOutlined,
  BulbOutlined, AimOutlined
} from '@ant-design/icons';
import { authFetch } from '@/app/_lib/api';

interface QuestionOption {
  key: string;
  text: string;
}

interface Question {
  id: string;
  type: 'theory' | 'interactive';
  question: string;
  options: QuestionOption[];
  answer: string;
  explanation?: string;
  highlightNodeKey?: string;
  relatedOutlineItemId?: string;
}

interface QuestionEditorProps {
  courseId: string;
  questions: Question[];
  onChange: (questions: Question[]) => void;
  annotations?: any[]; // 课件标注列表，用于互动题选择高亮对象
  visible: boolean;
  onClose: () => void;
}

export default function QuestionEditor({ 
  courseId, 
  questions = [], 
  onChange, 
  annotations = [],
  visible,
  onClose
}: QuestionEditorProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  
  // 生成配置
  const [generateConfig, setGenerateConfig] = useState({
    questionCount: 10,
    theoryRatio: 0.6
  });

  // AI生成考题
  const handleGenerateQuestions = async () => {
    if (!courseId) {
      message.error('课程ID无效');
      return;
    }
    
    setGenerating(true);
    try {
      const res = await authFetch<any>('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          questionCount: generateConfig.questionCount,
          theoryRatio: generateConfig.theoryRatio
        })
      });
      
      if (res.questions && Array.isArray(res.questions)) {
        onChange(res.questions);
        message.success(`成功生成 ${res.questions.length} 道考题！`);
      }
    } catch (e: any) {
      message.error(e?.message || 'AI生成考题失败');
    } finally {
      setGenerating(false);
    }
  };

  // 添加题目
  const handleAddQuestion = () => {
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      type: 'theory',
      question: '',
      options: [
        { key: 'A', text: '' },
        { key: 'B', text: '' },
        { key: 'C', text: '' },
        { key: 'D', text: '' }
      ],
      answer: 'A',
      explanation: ''
    };
    setEditingQuestion(newQuestion);
    form.setFieldsValue({
      ...newQuestion,
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: ''
    });
    setEditModalVisible(true);
  };

  // 编辑题目
  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    form.setFieldsValue({
      ...question,
      optionA: question.options.find(o => o.key === 'A')?.text || '',
      optionB: question.options.find(o => o.key === 'B')?.text || '',
      optionC: question.options.find(o => o.key === 'C')?.text || '',
      optionD: question.options.find(o => o.key === 'D')?.text || ''
    });
    setEditModalVisible(true);
  };

  // 保存题目
  const handleSaveQuestion = async () => {
    try {
      const values = await form.validateFields();
      const updatedQuestion: Question = {
        ...editingQuestion!,
        type: values.type,
        question: values.question,
        options: [
          { key: 'A', text: values.optionA },
          { key: 'B', text: values.optionB },
          { key: 'C', text: values.optionC },
          { key: 'D', text: values.optionD }
        ],
        answer: values.answer,
        explanation: values.explanation,
        highlightNodeKey: values.type === 'interactive' ? values.highlightNodeKey : undefined,
        relatedOutlineItemId: values.relatedOutlineItemId
      };

      const isNew = !questions.find(q => q.id === editingQuestion?.id);
      let newQuestions: Question[];
      
      if (isNew) {
        newQuestions = [...questions, updatedQuestion];
      } else {
        newQuestions = questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q);
      }
      
      onChange(newQuestions);
      setEditModalVisible(false);
      setEditingQuestion(null);
      form.resetFields();
      message.success(isNew ? '添加成功' : '保存成功');
    } catch (e) {
      // 表单验证失败
    }
  };

  // 删除题目
  const handleDeleteQuestion = (questionId: string) => {
    const newQuestions = questions.filter(q => q.id !== questionId);
    onChange(newQuestions);
    message.success('删除成功');
  };

  // 保存到服务器
  const handleSaveToServer = async () => {
    setLoading(true);
    try {
      await authFetch('/api/ai/questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          questions
        })
      });
      message.success('考题保存成功');
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const theoryCount = questions.filter(q => q.type === 'theory').length;
  const interactiveCount = questions.filter(q => q.type === 'interactive').length;

  return (
    <Modal
      title={
        <Space>
          <QuestionCircleOutlined />
          <span>考题管理</span>
          <Tag color="blue">{questions.length} 题</Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" onClick={handleSaveToServer} loading={loading}>
            保存考题
          </Button>
        </Space>
      }
    >
      {/* 生成配置区域 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>题目数量：</span>
            <InputNumber 
              min={1} 
              max={50} 
              value={generateConfig.questionCount}
              onChange={(v) => setGenerateConfig({ ...generateConfig, questionCount: v || 10 })}
              style={{ width: 80 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span>理论题比例：</span>
            <Slider 
              min={0} 
              max={100} 
              value={generateConfig.theoryRatio * 100}
              onChange={(v) => setGenerateConfig({ ...generateConfig, theoryRatio: v / 100 })}
              style={{ width: 120 }}
              tooltip={{ formatter: (v) => `${v}%` }}
            />
            <span style={{ color: '#666', fontSize: 12 }}>
              理论题 {Math.round(generateConfig.questionCount * generateConfig.theoryRatio)} 道，
              互动题 {generateConfig.questionCount - Math.round(generateConfig.questionCount * generateConfig.theoryRatio)} 道
            </span>
          </div>
          <Button 
            type="primary" 
            icon={<RobotOutlined />}
            onClick={handleGenerateQuestions}
            loading={generating}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
          >
            AI生成考题
          </Button>
        </div>
      </Card>

      {/* 题目统计 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Tag icon={<BulbOutlined />} color="green">理论题 {theoryCount} 道</Tag>
          <Tag icon={<AimOutlined />} color="purple">互动题 {interactiveCount} 道</Tag>
        </Space>
        <Button icon={<PlusOutlined />} onClick={handleAddQuestion}>
          手动添加
        </Button>
      </div>

      {/* 题目列表 */}
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {questions.length === 0 ? (
          <Empty 
            description="暂无考题，请点击AI生成或手动添加" 
            style={{ padding: 40 }}
          />
        ) : (
          <Collapse accordion>
            {questions.map((question, index) => (
              <Collapse.Panel
                key={question.id}
                header={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={question.type === 'theory' ? 'green' : 'purple'}>
                      {question.type === 'theory' ? '理论' : '互动'}
                    </Tag>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {index + 1}. {question.question || '(未填写题目)'}
                    </span>
                    <Tag color="blue">答案: {question.answer}</Tag>
                  </div>
                }
                extra={
                  <Space onClick={(e) => e.stopPropagation()}>
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<EditOutlined />}
                      onClick={() => handleEditQuestion(question)}
                    />
                    <Popconfirm
                      title="确定删除这道题吗？"
                      onConfirm={() => handleDeleteQuestion(question.id)}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                }
              >
                <div>
                  <div style={{ marginBottom: 12, color: 'rgba(255, 255, 255, 0.9)' }}>
                    <strong>题目：</strong>{question.question}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    {question.options.map(opt => (
                      <div 
                        key={opt.key} 
                        style={{ 
                          padding: '8px 12px',
                          marginBottom: 6,
                          background: opt.key === question.answer 
                            ? 'rgba(16, 185, 129, 0.15)' 
                            : 'rgba(255, 255, 255, 0.05)',
                          border: opt.key === question.answer 
                            ? '1px solid rgba(16, 185, 129, 0.5)' 
                            : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 6,
                          color: opt.key === question.answer 
                            ? '#10b981' 
                            : 'rgba(255, 255, 255, 0.85)'
                        }}
                      >
                        <Space>
                          {opt.key === question.answer && <CheckCircleOutlined style={{ color: '#10b981' }} />}
                          <span><strong>{opt.key}.</strong> {opt.text}</span>
                        </Space>
                      </div>
                    ))}
                  </div>
                  {question.explanation && (
                    <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}>
                      <strong style={{ color: 'rgba(255, 255, 255, 0.8)' }}>解析：</strong>{question.explanation}
                    </div>
                  )}
                  {question.highlightNodeKey && (
                    <div style={{ color: '#a78bfa', fontSize: 12, marginTop: 8 }}>
                      <strong>高亮节点：</strong>{question.highlightNodeKey}
                    </div>
                  )}
                </div>
              </Collapse.Panel>
            ))}
          </Collapse>
        )}
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title={editingQuestion && questions.find(q => q.id === editingQuestion.id) ? '编辑题目' : '添加题目'}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingQuestion(null);
          form.resetFields();
        }}
        onOk={handleSaveQuestion}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="题目类型" name="type" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="theory">
                <BulbOutlined /> 理论题
              </Radio.Button>
              <Radio.Button value="interactive">
                <AimOutlined /> 互动题
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="题目内容" name="question" rules={[{ required: true, message: '请输入题目内容' }]}>
            <Input.TextArea rows={2} placeholder="请输入题目内容" />
          </Form.Item>

          <Form.Item label="选项A" name="optionA" rules={[{ required: true, message: '请输入选项A' }]}>
            <Input placeholder="选项A内容" />
          </Form.Item>
          <Form.Item label="选项B" name="optionB" rules={[{ required: true, message: '请输入选项B' }]}>
            <Input placeholder="选项B内容" />
          </Form.Item>
          <Form.Item label="选项C" name="optionC" rules={[{ required: true, message: '请输入选项C' }]}>
            <Input placeholder="选项C内容" />
          </Form.Item>
          <Form.Item label="选项D" name="optionD" rules={[{ required: true, message: '请输入选项D' }]}>
            <Input placeholder="选项D内容" />
          </Form.Item>

          <Form.Item label="正确答案" name="answer" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="A">A</Radio.Button>
              <Radio.Button value="B">B</Radio.Button>
              <Radio.Button value="C">C</Radio.Button>
              <Radio.Button value="D">D</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="答案解析" name="explanation">
            <Input.TextArea rows={2} placeholder="可选：输入答案解析" />
          </Form.Item>

          <Form.Item 
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => 
              getFieldValue('type') === 'interactive' && (
                <Form.Item 
                  label={
                    <Space>
                      高亮模型节点
                      <Tooltip title="选择答题时要高亮显示的模型部件">
                        <QuestionCircleOutlined />
                      </Tooltip>
                    </Space>
                  } 
                  name="highlightNodeKey"
                  rules={[{ required: true, message: '互动题必须选择高亮节点' }]}
                >
                  <Select 
                    placeholder="选择要高亮的模型节点" 
                    showSearch
                    optionFilterProp="children"
                  >
                    {annotations.map(ann => (
                      <Select.Option key={ann.nodeKey} value={ann.nodeKey}>
                        {ann.title} ({ann.nodeKey})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
}

