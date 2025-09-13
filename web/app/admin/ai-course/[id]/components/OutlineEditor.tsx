"use client";
import { useState } from 'react';
import { Tree, Button, Space, Modal, Form, Input, Select, message, Collapse, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DragOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';

interface OutlineEditorProps {
  outline: any[];
  onChange: (newOutline: any[]) => void;
  onSelectItem: (item: any) => void;
}

export default function OutlineEditor({ outline, onChange, onSelectItem }: OutlineEditorProps) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();

  // 将 outline 转换为 Tree 数据结构
  const convertToTreeData = (outline: any[]): DataNode[] => {
    return outline.map((segment, segIndex) => ({
      key: `seg-${segIndex}`,
      title: (
        <div className="segment-node">
          <span className="segment-title">{segment.title || `段落 ${segIndex + 1}`}</span>
          <Tag color="blue" style={{ marginLeft: 8 }}>{segment.mode}</Tag>
          <Space size="small" style={{ marginLeft: 8 }}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); editSegment(segment, segIndex); }} />
            <Button type="text" size="small" icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); deleteSegment(segIndex); }} />
          </Space>
        </div>
      ),
      children: segment.items?.map((item: any, itemIndex: number) => ({
        key: `${segIndex}-${itemIndex}`,
        title: (
          <div className="item-node">
            <Tag color={getItemColor(item.type)}>{item.type}</Tag>
            <span>{item.say?.slice(0, 30)}...</span>
            <Space size="small" style={{ marginLeft: 8 }}>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); editItem(item, segIndex, itemIndex); }} />
              <Button type="text" size="small" icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); deleteItem(segIndex, itemIndex); }} />
            </Space>
          </div>
        )
      })) || []
    }));
  };

  const getItemColor = (type: string) => {
    switch (type) {
      case 'talk': return 'green';
      case 'image.explain': return 'orange';
      case 'scene.action': return 'purple';
      default: return 'default';
    }
  };

  const editSegment = (segment: any, index: number) => {
    setEditingItem({ ...segment, _type: 'segment', _index: index });
    form.setFieldsValue(segment);
    setEditModalVisible(true);
  };

  const editItem = (item: any, segIndex: number, itemIndex: number) => {
    setEditingItem({ ...item, _type: 'item', _segIndex: segIndex, _itemIndex: itemIndex });
    form.setFieldsValue(item);
    setEditModalVisible(true);
  };

  const deleteSegment = (index: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个段落吗？',
      onOk: () => {
        const newOutline = [...outline];
        newOutline.splice(index, 1);
        onChange(newOutline);
        message.success('删除成功');
      }
    });
  };

  const deleteItem = (segIndex: number, itemIndex: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个项目吗？',
      onOk: () => {
        const newOutline = [...outline];
        newOutline[segIndex].items.splice(itemIndex, 1);
        onChange(newOutline);
        message.success('删除成功');
      }
    });
  };

  const addSegment = () => {
    const newSegment = {
      id: `seg-${Date.now()}`,
      title: '新段落',
      mode: 'sequence',
      items: []
    };
    const newOutline = [...outline, newSegment];
    onChange(newOutline);
    message.success('添加段落成功');
  };

  const addItem = (segIndex: number) => {
    const newItem = {
      id: `item-${Date.now()}`,
      type: 'talk',
      say: '新的讲解内容...',
      estimatedDuration: 30
    };
    const newOutline = [...outline];
    if (!newOutline[segIndex].items) {
      newOutline[segIndex].items = [];
    }
    newOutline[segIndex].items.push(newItem);
    onChange(newOutline);
    message.success('添加项目成功');
  };

  const onEditFinish = (values: any) => {
    if (editingItem._type === 'segment') {
      const newOutline = [...outline];
      newOutline[editingItem._index] = { ...newOutline[editingItem._index], ...values };
      onChange(newOutline);
    } else if (editingItem._type === 'item') {
      const newOutline = [...outline];
      newOutline[editingItem._segIndex].items[editingItem._itemIndex] = { 
        ...newOutline[editingItem._segIndex].items[editingItem._itemIndex], 
        ...values 
      };
      onChange(newOutline);
    }
    setEditModalVisible(false);
    setEditingItem(null);
    form.resetFields();
    message.success('保存成功');
  };

  const onTreeSelect = (selectedKeys: string[], info: any) => {
    setSelectedKeys(selectedKeys);
    if (info.node && selectedKeys.length > 0) {
      const key = selectedKeys[0];
      const [segIndex, itemIndex] = key.split('-').map(Number);
      
      if (itemIndex !== undefined && !isNaN(itemIndex)) {
        // 选中了具体的 item
        const item = outline[segIndex]?.items?.[itemIndex];
        if (item) {
          onSelectItem(item);
        }
      }
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={addSegment}>
            添加段落
          </Button>
        </Space>
      </div>

      <div style={{ padding: 16 }}>
        {outline.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
            暂无课程大纲，请点击"AI生成初稿"或手动添加段落
          </div>
        ) : (
          <div>
            {outline.map((segment, segIndex) => (
              <Collapse key={segIndex} style={{ marginBottom: 16, background: 'var(--color-bg-container)' }}>
                <Collapse.Panel
                  header={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 }}>
                        <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                          {segment.title || `段落 ${segIndex + 1}`}
                        </span>
                        <Tag color="blue" style={{ marginLeft: 8, flexShrink: 0, fontSize: '11px' }}>{segment.mode}</Tag>
                      </div>
                      <Space onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }} size="small">
                        <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => addItem(segIndex)} title="添加项目" />
                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => editSegment(segment, segIndex)} title="编辑段落" />
                        <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => deleteSegment(segIndex)} title="删除段落" />
                      </Space>
                    </div>
                  }
                  key={segIndex}
                >
                  {segment.items?.map((item: any, itemIndex: number) => (
                    <div
                      key={itemIndex}
                      style={{
                        padding: 12,
                        border: '1px solid var(--color-border)',
                        borderRadius: 6,
                        marginBottom: 8,
                        cursor: 'pointer',
                        backgroundColor: selectedKeys.includes(`${segIndex}-${itemIndex}`) ? 'var(--color-primary-bg)' : 'var(--color-bg-container)'
                      }}
                      onClick={() => onTreeSelect([`${segIndex}-${itemIndex}`], { node: { key: `${segIndex}-${itemIndex}` } })}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
                        <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                          <Tag color={getItemColor(item.type)} style={{ fontSize: '11px' }}>{item.type}</Tag>
                          <span style={{ marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 180 }}>
                            {item.say?.slice(0, 50)}...
                          </span>
                          {item.estimatedDuration && (
                            <Tag style={{ marginLeft: 8, fontSize: '11px' }}>{item.estimatedDuration}s</Tag>
                          )}
                        </div>
                        <Space onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }} size="small">
                          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => editItem(item, segIndex, itemIndex)} title="编辑项目" />
                          <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => deleteItem(segIndex, itemIndex)} title="删除项目" />
                        </Space>
                      </div>
                    </div>
                  )) || []}
                </Collapse.Panel>
              </Collapse>
            ))}
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      <Modal
        title={editingItem?._type === 'segment' ? '编辑段落' : '编辑项目'}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingItem(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={onEditFinish}>
          {editingItem?._type === 'segment' ? (
            <>
              <Form.Item label="段落标题" name="title" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="执行模式" name="mode">
                <Select>
                  <Select.Option value="sequence">顺序执行</Select.Option>
                  <Select.Option value="parallel">并行执行</Select.Option>
                </Select>
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item label="类型" name="type" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="talk">纯讲解</Select.Option>
                  <Select.Option value="image.explain">图片说明</Select.Option>
                  <Select.Option value="scene.action">三维动作</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="讲解内容" name="say" rules={[{ required: true }]}>
                <Input.TextArea rows={4} />
              </Form.Item>
              <Form.Item label="预估时长(秒)" name="estimatedDuration">
                <Input type="number" />
              </Form.Item>
              {editingItem?.type === 'image.explain' && (
                <Form.Item label="图片关键词" name="imageKeywords">
                  <Input placeholder="用于搜索相关图片" />
                </Form.Item>
              )}
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
