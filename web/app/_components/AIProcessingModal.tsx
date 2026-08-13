"use client";
import { useEffect, useState, useRef } from 'react';

interface AIProcessingModalProps {
  open: boolean;
  title?: string;
  messages?: string[];
  width?: number;
}

const DEFAULT_MESSAGES = [
  'AI 正在思考中...',
  '正在分析课件内容...',
  '构建知识图谱...',
  '生成专业内容...',
  '优化表达逻辑...',
  '即将完成...',
];

const ICONS = ['🤖', '⚙️', '✨', '🧠', '💡'];

export default function AIProcessingModal({
  open,
  title = 'AI 处理中',
  messages = DEFAULT_MESSAGES,
  width = 440,
}: AIProcessingModalProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open) {
      setMessageIndex(0);
      setIconIndex(0);
      setProgress(0);

      // 循环切换提示文字和图标
      timerRef.current = setInterval(() => {
        setMessageIndex(prev => (prev + 1) % messages.length);
        setIconIndex(prev => (prev + 1) % ICONS.length);
      }, 2500);

      // 动态省略号
      dotRef.current = setInterval(() => {
        setDots(prev => {
          if (prev.length >= 3) return '';
          return prev + '.';
        });
      }, 500);

      // 模拟进度条（永远不会到100，直到关闭）
      progressRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          const remaining = 90 - prev;
          const increment = Math.max(0.5, remaining * 0.06);
          return prev + increment;
        });
      }, 400);
    } else {
      setProgress(100);
      const t = setTimeout(() => setProgress(0), 300);
      return () => clearTimeout(t);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dotRef.current) clearInterval(dotRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [open, messages.length]);

  if (!open) return null;

  return (
    <>
      {/* 全屏遮罩 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 弹窗主体 */}
        <div
          style={{
            width,
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            borderRadius: 20,
            padding: '40px 36px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(99, 102, 241, 0.15)',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(99, 102, 241, 0.2)',
          }}
        >
          {/* 背景旋转光晕 */}
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: 'conic-gradient(from 0deg, transparent 0%, rgba(99, 102, 241, 0.08) 25%, transparent 50%, rgba(168, 85, 247, 0.08) 75%, transparent 100%)',
              animation: 'ai-spin 6s linear infinite',
              pointerEvents: 'none',
            }}
          />

          {/* AI 图标 + 脉冲光环 */}
          <div
            style={{
              position: 'relative',
              width: 90,
              height: 90,
              margin: '0 auto 24px',
            }}
          >
            {/* 外层脉冲环 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid rgba(99, 102, 241, 0.4)',
                animation: 'ai-pulse 2s ease-out infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid rgba(168, 85, 247, 0.3)',
                animation: 'ai-pulse 2s ease-out infinite 0.5s',
              }}
            />
            {/* 中心圆 */}
            <div
              style={{
                position: 'absolute',
                inset: 8,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                boxShadow: '0 0 30px rgba(99, 102, 241, 0.5)',
                transition: 'transform 0.4s ease',
                animation: 'ai-float 3s ease-in-out infinite',
              }}
            >
              <span style={{ animation: 'ai-icon-swap 0.4s ease' }} key={iconIndex}>
                {ICONS[iconIndex]}
              </span>
            </div>
          </div>

          {/* 标题 */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#e0e7ff',
              marginBottom: 8,
              letterSpacing: 1,
            }}
          >
            {title}
          </div>

          {/* 动态提示文字 */}
          <div
            style={{
              fontSize: 14,
              color: '#a5b4fc',
              marginBottom: 28,
              minHeight: 22,
              transition: 'opacity 0.3s ease',
            }}
            key={messageIndex}
          >
            {messages[messageIndex]}
            <span style={{ display: 'inline-block', width: 20, textAlign: 'left' }}>{dots}</span>
          </div>

          {/* 进度条 */}
          <div
            style={{
              width: '100%',
              height: 6,
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
                borderRadius: 3,
                transition: 'width 0.4s ease',
                boxShadow: '0 0 12px rgba(168, 85, 247, 0.6)',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            {Math.round(progress)}%
          </div>

          {/* 底部加载点动画 */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#6366f1',
                  animation: `ai-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 关键帧动画 */}
      <style>{`
        @keyframes ai-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ai-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes ai-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes ai-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes ai-icon-swap {
          0% { transform: scale(0.5) rotate(-15deg); opacity: 0; }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
