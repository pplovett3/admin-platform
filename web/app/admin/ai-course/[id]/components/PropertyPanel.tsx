"use client";
import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, Space, Upload, Image, Tag, message, Modal, Row, Col, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { authFetch } from '@/app/_lib/api';

interface PropertyPanelProps {
  selectedItem: any;
  onItemChange: (updatedItem: any) => void;
  coursewareId?: string;
}

export default function PropertyPanel({ selectedItem, onItemChange, coursewareId }: PropertyPanelProps) {
  const [form] = Form.useForm();
  const [actions, setActions] = useState<any[]>([]);
  const [imageSearchVisible, setImageSearchVisible] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchKeywords, setSearchKeywords] = useState('');
  const [coursewareData, setCoursewareData] = useState<any>(null);

  useEffect(() => {
    if (selectedItem) {
      form.setFieldsValue(selectedItem);
      setActions(selectedItem.actions || []);
    }
  }, [selectedItem, form]);

  // 加载courseware数据
  useEffect(() => {
    if (coursewareId) {
      loadCoursewareData();
    }
  }, [coursewareId]);

  async function loadCoursewareData() {
    if (!coursewareId) return;
    try {
      const data = await authFetch<any>(`/api/courseware/${coursewareId}`);
      setCoursewareData(data);
    } catch (error) {
      console.error('加载课件数据失败:', error);
    }
  }

  // 根据动画ID获取动画名称
  const getAnimationName = (animationId: string) => {
    if (!coursewareData?.animations) return animationId;
    const animation = coursewareData.animations.find((anim: any) => anim.id === animationId);
    return animation ? animation.name : animationId;
  };

  const onFormChange = (changedValues: any, allValues: any) => {
    if (selectedItem) {
      const updatedItem = { ...selectedItem, ...allValues, actions };
      onItemChange(updatedItem);
    }
  };

  const addAction = () => {
    const newAction = {
      type: 'camera.focus',
      target: { nodeKey: '' },
      duration: 2.0,
      easing: 'easeInOut'
    };
    const newActions = [...actions, newAction];
    setActions(newActions);
    
    if (selectedItem) {
      const updatedItem = { ...selectedItem, actions: newActions };
      onItemChange(updatedItem);
    }
  };

  const updateAction = (index: number, field: string, value: any) => {
    const newActions = [...actions];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (!newActions[index][parent]) {
        newActions[index][parent] = {};
      }
      newActions[index][parent][child] = value;
    } else {
      newActions[index][field] = value;
    }
    setActions(newActions);
    
    if (selectedItem) {
      const updatedItem = { ...selectedItem, actions: newActions };
      onItemChange(updatedItem);
    }
  };

  const deleteAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    setActions(newActions);
    
    if (selectedItem) {
      const updatedItem = { ...selectedItem, actions: newActions };
      onItemChange(updatedItem);
    }
  };

  if (!selectedItem) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
        请在左侧选择一个项目进行编辑
      </div>
    );
  }

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <Form
        form={form}
        layout="vertical"
        onValuesChange={onFormChange}
        size="small"
      >
        <Card title="基础信息" size="small" style={{ marginBottom: 16 }}>
          <Form.Item label="类型" name="type">
            <Select>
              <Select.Option value="talk">纯讲解</Select.Option>
              <Select.Option value="image.explain">图片说明</Select.Option>
              <Select.Option value="scene.action">三维动作</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item label="讲解内容" name="say">
            <Input.TextArea rows={4} placeholder="输入讲解文本..." />
          </Form.Item>
          
          <Form.Item label="预估时长(秒)" name="estimatedDuration">
            <Input type="number" />
          </Form.Item>
        </Card>

        {selectedItem.type === 'image.explain' && (
          <Card title="图片配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item label="搜索关键词" name="imageKeywords">
              <Input placeholder="用于搜索相关图片，如：发动机结构图" />
            </Form.Item>
            
            <Form.Item label="图片URL" name={['image', 'src']}>
              <Input placeholder="图片链接" />
            </Form.Item>
            
            <Form.Item label="图片标题" name={['image', 'title']}>
              <Input placeholder="图片标题" />
            </Form.Item>
            
            {selectedItem.image?.src && (
              <div style={{ marginBottom: 16 }}>
                <Image
                  width={200}
                  src={selectedItem.image.src}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN..."
                />
              </div>
            )}
            
            <Space>
              <Button 
                icon={<SearchOutlined />} 
                onClick={() => {
                  const keywords = selectedItem.imageKeywords || form.getFieldValue('imageKeywords');
                  if (keywords) {
                    setSearchKeywords(keywords);
                    setImageSearchVisible(true);
                    searchImages(keywords);
                  } else {
                    message.warning('请先输入搜索关键词');
                  }
                }}
              >
                搜索图片
              </Button>
              <Button onClick={() => setImageSearchVisible(true)}>
                手动搜索
              </Button>
            </Space>
          </Card>
        )}

        {selectedItem.type === 'scene.action' && (
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>三维动作</span>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addAction}>
                  添加动作
                </Button>
              </div>
            } 
            size="small"
          >
            {actions.map((action, index) => (
              <Card 
                key={index} 
                size="small" 
                style={{ marginBottom: 12 }}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tag color="purple">动作 {index + 1}</Tag>
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<DeleteOutlined />} 
                      onClick={() => deleteAction(index)}
                    />
                  </div>
                }
              >
                <Form.Item label="动作类型" style={{ marginBottom: 8 }}>
                  <Select
                    value={action.type}
                    onChange={(value) => updateAction(index, 'type', value)}
                    size="small"
                  >
                    <Select.Option value="camera.focus">相机对焦</Select.Option>
                    <Select.Option value="visibility.set">显隐控制</Select.Option>
                    <Select.Option value="highlight.show">高亮显示</Select.Option>
                    <Select.Option value="annotation.show">显示标注</Select.Option>
                    <Select.Option value="animation.play">播放动画</Select.Option>
                  </Select>
                </Form.Item>
                
                {(action.type === 'camera.focus' || action.type === 'highlight.show') && (
                  <Form.Item label="目标节点" style={{ marginBottom: 8 }}>
                    <Input
                      value={action.target?.nodeKey || ''}
                      onChange={(e) => updateAction(index, 'target.nodeKey', e.target.value)}
                      placeholder="如：Root/Engine 或从三维视窗中选择"
                      size="small"
                    />
                  </Form.Item>
                )}
                
                {action.type === 'annotation.show' && (
                  <Form.Item label="标注IDs" style={{ marginBottom: 8 }}>
                    <Input
                      value={action.ids?.join(', ') || ''}
                      onChange={(e) => updateAction(index, 'ids', e.target.value.split(',').map(id => id.trim()).filter(Boolean))}
                      placeholder="标注ID列表，用逗号分隔"
                      size="small"
                    />
                  </Form.Item>
                )}
                
                {action.type === 'animation.play' && (
                  <>
                    <Form.Item label="选择动画" style={{ marginBottom: 8 }}>
                      <Select
                        value={action.animationId || ''}
                        onChange={(value) => updateAction(index, 'animationId', value)}
                        placeholder="选择动画"
                        size="small"
                        showSearch
                        optionFilterProp="children"
                        style={{ width: '100%' }}
                      >
                        {coursewareData?.animations?.map((anim: any) => (
                          <Select.Option key={anim.id} value={anim.id}>
                            {anim.name}
                            {anim.description && (
                              <div style={{ fontSize: '11px', color: '#999', marginTop: 2 }}>
                                {anim.description}
                              </div>
                            )}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Space style={{ width: '100%' }}>
                      <Form.Item label="开始时间" style={{ marginBottom: 8, flex: 1 }}>
                        <Input
                          type="number"
                          value={action.startTime || 0}
                          onChange={(e) => updateAction(index, 'startTime', parseFloat(e.target.value))}
                          size="small"
                        />
                      </Form.Item>
                      <Form.Item label="结束时间" style={{ marginBottom: 8, flex: 1 }}>
                        <Input
                          type="number"
                          value={action.endTime || 0}
                          onChange={(e) => updateAction(index, 'endTime', parseFloat(e.target.value))}
                          size="small"
                        />
                      </Form.Item>
                    </Space>
                  </>
                )}
                
                {(action.type === 'camera.focus' || action.type === 'highlight.show') && (
                  <Space style={{ width: '100%' }}>
                    <Form.Item label="持续时间" style={{ marginBottom: 8, flex: 1 }}>
                      <Input
                        type="number"
                        value={action.duration || 2}
                        onChange={(e) => updateAction(index, 'duration', parseFloat(e.target.value))}
                        size="small"
                      />
                    </Form.Item>
                    <Form.Item label="缓动" style={{ marginBottom: 8, flex: 1 }}>
                      <Select
                        value={action.easing || 'easeInOut'}
                        onChange={(value) => updateAction(index, 'easing', value)}
                        size="small"
                      >
                        <Select.Option value="linear">线性</Select.Option>
                        <Select.Option value="easeIn">缓入</Select.Option>
                        <Select.Option value="easeOut">缓出</Select.Option>
                        <Select.Option value="easeInOut">缓入缓出</Select.Option>
                      </Select>
                    </Form.Item>
                  </Space>
                )}
              </Card>
            ))}
            
            {actions.length === 0 && (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                暂无动作，点击"添加动作"开始配置
              </div>
            )}
          </Card>
        )}

        <Card title="TTS配置 (Minimax)" size="small">
          <Form.Item label="性别" name={['tts', 'gender']}>
            <Select placeholder="选择性别" onChange={(value) => {
              // 性别改变时重置音色
              form.setFieldValue(['tts', 'voice_id'], undefined);
            }}>
              <Select.Option value="female">女声</Select.Option>
              <Select.Option value="male">男声</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item label="音色" name={['tts', 'voice_id']}>
            <Select placeholder="选择音色" disabled={!form.getFieldValue(['tts', 'gender'])}>
              {form.getFieldValue(['tts', 'gender']) === 'female' && (
                <>
                  <Select.Option value="female-shaonv">少女音色</Select.Option>
                  <Select.Option value="female-yujie">御姐音色</Select.Option>
                  <Select.Option value="female-chengshu">成熟女性音色</Select.Option>
                  <Select.Option value="female-tianmei">甜美女性音色</Select.Option>
                  <Select.Option value="presenter_female">女性主持人</Select.Option>
                  <Select.Option value="audiobook_female_1">女性有声书1</Select.Option>
                  <Select.Option value="audiobook_female_2">女性有声书2</Select.Option>
                  <Select.Option value="lovely_girl">萌萌女童</Select.Option>
                  <Select.Option value="tianxin_xiaoling">甜心小玲</Select.Option>
                  <Select.Option value="qiaopi_mengmei">俏皮萌妹</Select.Option>
                  <Select.Option value="wumei_yujie">妩媚御姐</Select.Option>
                  <Select.Option value="diadia_xuemei">嗲嗲学妹</Select.Option>
                  <Select.Option value="danya_xuejie">淡雅学姐</Select.Option>
                </>
              )}
              {form.getFieldValue(['tts', 'gender']) === 'male' && (
                <>
                  <Select.Option value="male-qn-qingse">青涩青年音色</Select.Option>
                  <Select.Option value="male-qn-jingying">精英青年音色</Select.Option>
                  <Select.Option value="male-qn-badao">霸道青年音色</Select.Option>
                  <Select.Option value="male-qn-daxuesheng">青年大学生音色</Select.Option>
                  <Select.Option value="presenter_male">男性主持人</Select.Option>
                  <Select.Option value="audiobook_male_1">男性有声书1</Select.Option>
                  <Select.Option value="audiobook_male_2">男性有声书2</Select.Option>
                  <Select.Option value="clever_boy">聪明男童</Select.Option>
                  <Select.Option value="cute_boy">可爱男童</Select.Option>
                  <Select.Option value="bingjiao_didi">病娇弟弟</Select.Option>
                  <Select.Option value="junlang_nanyou">俊朗男友</Select.Option>
                  <Select.Option value="chunzhen_xuedi">纯真学弟</Select.Option>
                  <Select.Option value="lengdan_xiongzhang">冷淡学长</Select.Option>
                  <Select.Option value="badao_shaoye">霸道少爷</Select.Option>
                </>
              )}
            </Select>
          </Form.Item>
          
          <Form.Item label="语速" name={['tts', 'speed']}>
            <Input type="number" step="0.1" placeholder="1.0" min="0.5" max="2.0" />
          </Form.Item>

          <Form.Item label="音量" name={['tts', 'vol']}>
            <Input type="number" step="0.1" placeholder="1.0" min="0.1" max="2.0" />
          </Form.Item>

          <Form.Item label="音调" name={['tts', 'pitch']}>
            <Input type="number" step="1" placeholder="0" min="-12" max="12" />
          </Form.Item>
          
          <Button 
            loading={false}
            onClick={async () => {
              const ttsConfig = form.getFieldValue('tts');
              if (!selectedItem?.say?.trim()) {
                message.warning('请先输入要试听的文本');
                return;
              }
              if (!ttsConfig?.voice_id) {
                message.warning('请先选择音色');
                return;
              }
              
              let hide = message.loading('正在创建TTS任务...', 0);
              
              try {
                // 1. 创建TTS任务
                const createResponse = await authFetch<any>('/api/ai/tts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: selectedItem.say.slice(0, 100), // 限制试听文本长度
                    voice_id: ttsConfig.voice_id,
                    speed: ttsConfig.speed || 1.0,
                    vol: ttsConfig.vol || 1.0,
                    pitch: ttsConfig.pitch || 0,
                    model: 'speech-01-turbo'
                  })
                });
                
                if (!createResponse.taskId) {
                  throw new Error('任务创建失败');
                }

                // 更新loading状态
                hide();
                hide = message.loading(`正在生成语音 (预计1-2分钟)...`, 0);

                // 2. 轮询任务状态
                let attempts = 0;
                const maxAttempts = 120; // 最多等待2分钟
                let pollInterval = 1000; // 初始轮询间隔1秒
                
                const pollStatus = async (): Promise<void> => {
                  if (attempts >= maxAttempts) {
                    throw new Error('语音生成超时，请检查网络或稍后重试');
                  }
                  
                  attempts++;
                  
                  try {
                    const statusResponse = await authFetch<any>(`/api/ai/tts/status?task_id=${createResponse.taskId}`);
                    
                    if (statusResponse.status === 'Success' && statusResponse.downloadUrl) {
                      hide();
                      // 播放音频
                      const audio = new Audio(statusResponse.downloadUrl);
                      audio.play();
                      message.success('开始播放试听音频');
                    } else if (statusResponse.status === 'Failed') {
                      throw new Error('语音生成失败，请重试');
                    } else if (statusResponse.status === 'Processing') {
                      // 动态调整轮询间隔，避免频繁请求
                      if (attempts > 10) pollInterval = 2000; // 10秒后改为2秒间隔
                      if (attempts > 30) pollInterval = 3000; // 30秒后改为3秒间隔
                      
                      // 更新progress信息
                      if (attempts % 10 === 0) {
                        hide();
                        const elapsed = Math.floor(attempts * pollInterval / 1000);
                        hide = message.loading(`正在生成语音 (已等待${elapsed}秒)...`, 0);
                      }
                      
                      // 继续等待
                      setTimeout(pollStatus, pollInterval);
                    } else if (statusResponse.status === 'Expired') {
                      throw new Error('任务已过期，请重新生成');
                    } else {
                      throw new Error(`未知状态: ${statusResponse.status}`);
                    }
                  } catch (error: any) {
                    // 网络错误或API错误，等待后重试
                    if (attempts < maxAttempts && error?.message?.includes('fetch')) {
                      console.warn(`轮询失败，第${attempts}次重试:`, error);
                      setTimeout(pollStatus, pollInterval);
                    } else {
                      throw error;
                    }
                  }
                };
                
                // 开始轮询，延迟2秒开始（给服务器处理时间）
                setTimeout(pollStatus, 2000);
                
              } catch (error: any) {
                hide();
                const errorMsg = error?.message || 'TTS试听失败';
                
                // 特殊处理余额不足错误
                if (errorMsg.includes('余额不足') || errorMsg.includes('insufficient balance')) {
                  Modal.error({
                    title: 'Minimax账户余额不足',
                    content: (
                      <div>
                        <p>您的Minimax账户余额不足，无法生成TTS音频。</p>
                        <p>请登录 <a href="https://platform.minimaxi.com/" target="_blank" rel="noopener noreferrer">Minimax控制台</a> 充值后重试。</p>
                      </div>
                    ),
                  });
                } else {
                  message.error(errorMsg);
                }
              }
            }}
          >
            试听
          </Button>
        </Card>
      </Form>

      {/* 图片搜索弹窗 */}
      <Modal
        title="搜索图片"
        open={imageSearchVisible}
        onCancel={() => {
          setImageSearchVisible(false);
          setSearchResults([]);
          setSearchKeywords('');
        }}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="输入搜索关键词，如：发动机结构图"
              value={searchKeywords}
              onChange={(e) => setSearchKeywords(e.target.value)}
              onPressEnter={() => searchImages(searchKeywords)}
            />
            <Button 
              type="primary" 
              icon={<SearchOutlined />}
              loading={searchLoading}
              onClick={() => searchImages(searchKeywords)}
            >
              搜索
            </Button>
          </Space.Compact>
        </div>

        <Spin spinning={searchLoading}>
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <Row gutter={[12, 12]}>
              {searchResults.map((img, index) => (
                <Col span={8} key={index}>
                  <div 
                    style={{ 
                      border: '1px solid #d9d9d9', 
                      borderRadius: 6, 
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                    onClick={() => selectImage(img)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#1890ff';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(24,144,255,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d9d9d9';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <Image
                      src={img.url}
                      alt={img.title}
                      style={{ width: '100%', height: 120, objectFit: 'cover' }}
                      fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjEwMCIgeT0iNjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOi9veWksei0pTwvdGV4dD48L3N2Zz4="
                      preview={false}
                    />
                    <div style={{ padding: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#666' }}>
                        来源: {img.source}
                      </div>
                      <div style={{ fontSize: 11, color: '#999' }}>
                        {img.size?.width}×{img.size?.height}
                      </div>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
            
            {searchResults.length === 0 && !searchLoading && searchKeywords && (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                未找到相关图片，请尝试其他关键词
              </div>
            )}
          </div>
        </Spin>
      </Modal>
    </div>
  );

  // 搜索图片函数
  async function searchImages(keywords: string) {
    if (!keywords?.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }

    setSearchLoading(true);
    try {
      const response = await authFetch<any>('/api/ai/search-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.trim() })
      });
      
      setSearchResults(response.images || []);
      if (response.images?.length === 0) {
        message.info('未找到相关图片');
      }
    } catch (error: any) {
      message.error(error?.message || '搜索失败');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  // 选择图片函数
  function selectImage(img: any) {
    if (selectedItem) {
      const updatedItem = {
        ...selectedItem,
        image: {
          src: img.url,
          title: img.title,
          source: { url: img.source, license: img.license || 'Unknown' }
        }
      };
      onItemChange(updatedItem);
      form.setFieldsValue({
        image: {
          src: img.url,
          title: img.title
        }
      });
      setImageSearchVisible(false);
      message.success('图片已选择');
    }
  }
}
