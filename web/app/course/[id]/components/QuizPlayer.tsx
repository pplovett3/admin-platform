"use client";
import { useEffect, useRef, useState, Component, ReactNode } from 'react';
import { Button, Radio, Space, Progress, Result, message, Modal, Spin } from 'antd';
import { 
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  TrophyOutlined, ReloadOutlined, LeftOutlined, RightOutlined
} from '@ant-design/icons';
import PublicThreeDViewer, { PublicThreeDViewerControls } from './PublicThreeDViewer';
import { useXRIntegration, XRButtonContainer, XRMode } from './xr';

// 错误边界组件
class QuizErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('QuizPlayer Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          width: '100%', 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#0a0a0a',
          color: 'white',
          padding: '20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>答题界面加载失败</div>
          <div style={{ 
            fontSize: '12px', 
            color: '#ff6b6b', 
            background: 'rgba(255,0,0,0.1)',
            padding: '15px',
            borderRadius: '8px',
            maxWidth: '90%',
            wordBreak: 'break-all',
            textAlign: 'left',
            fontFamily: 'monospace'
          }}>
            {this.state.error?.message || '未知错误'}
            <br/><br/>
            {this.state.error?.stack?.slice(0, 500)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface QuestionOption {
  key: string;
  text: string;
}

interface Question {
  id: string;
  type: 'theory' | 'interactive';
  question: string;
  options: QuestionOption[];
  highlightNodeKey?: string;
}

interface QuizPlayerProps {
  courseId: string;
  publishId: string;
  courseData: any;
  onBack: () => void;
}

interface QuizResult {
  score: number;
  correctCount: number;
  totalQuestions: number;
  details: {
    questionId: string;
    userAnswer: string;
    correctAnswer: string;
    correct: boolean;
    explanation?: string;
  }[];
}

export default function QuizPlayer({ courseId, publishId, courseData, onBack }: QuizPlayerProps) {
  const viewerRef = useRef<PublicThreeDViewerControls>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isXRMode, setIsXRMode] = useState(false);

  // 检测移动端（安全检查）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // XR相关状态 - 需要在modelLoaded后才能获取renderer
  const [xrRenderer, setXrRenderer] = useState<any>(null);
  const [xrScene, setXrScene] = useState<any>(null);
  const [xrCamera, setXrCamera] = useState<any>(null);

  // 当模型加载完成后，获取Three.js对象
  useEffect(() => {
    if (modelLoaded && viewerRef.current) {
      setXrRenderer(viewerRef.current.getRenderer());
      setXrScene(viewerRef.current.getScene());
      setXrCamera(viewerRef.current.getCamera());
    }
  }, [modelLoaded]);

  // XR集成 - VR答题支持
  const xrIntegration = useXRIntegration({
    renderer: xrRenderer,
    scene: xrScene,
    camera: xrCamera,
    modelRoot: viewerRef.current?.getModelRoot() || null,
    interactableObjects: viewerRef.current?.getInteractableObjects() || [],
    onNodeSelect: (nodeKey) => {
      // 在VR中选中节点时高亮
      viewerRef.current?.highlightNode(nodeKey, true);
    },
    onSessionStart: (mode: XRMode) => {
      setIsXRMode(true);
      message.success(`已进入${mode.toUpperCase()}答题模式`);
    },
    onSessionEnd: () => {
      setIsXRMode(false);
      message.info('已退出XR模式');
    }
  });

  // 在VR模式下更新答题面板
  useEffect(() => {
    if (isXRMode && questions.length > 0 && !submitted) {
      const currentQuestion = questions[currentIndex];
      xrIntegration.showQuizPanel(
        currentQuestion.question,
        currentQuestion.options,
        (key) => handleAnswer(currentQuestion.id, key),
        answers[currentQuestion.id]
      );
    }
  }, [isXRMode, currentIndex, answers, submitted]);

  // 在VR模式下显示结果
  useEffect(() => {
    if (isXRMode && showResult && result) {
      xrIntegration.hideQuizPanel();
      xrIntegration.showResultPanel(
        result.score,
        result.correctCount,
        result.totalQuestions,
        () => {
          xrIntegration.hideResultPanel();
          handleRetry();
        },
        () => {
          xrIntegration.exitXR();
          onBack();
        }
      );
    }
  }, [isXRMode, showResult, result]);

  // 加载考题
  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      try {
        const courseQuestions = courseData?.courseData?.questions || [];
        
        if (courseQuestions.length > 0) {
          const sanitizedQuestions = courseQuestions.map((q: any) => ({
            id: q.id,
            type: q.type,
            question: q.question,
            options: q.options,
            highlightNodeKey: q.highlightNodeKey
          }));
          setQuestions(sanitizedQuestions);
        } else {
          message.error('该课程暂无考题');
        }
      } catch (e: any) {
        message.error(e?.message || '加载考题失败');
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [courseData]);

  // 当切换到互动题时，高亮对应节点
  useEffect(() => {
    if (!modelLoaded || questions.length === 0) return;
    
    const currentQuestion = questions[currentIndex];
    
    viewerRef.current?.highlightNode('', false);
    
    if (currentQuestion?.type === 'interactive' && currentQuestion.highlightNodeKey) {
      viewerRef.current?.highlightNode(currentQuestion.highlightNodeKey, true);
      viewerRef.current?.focusOnNode(currentQuestion.highlightNodeKey);
    }
  }, [currentIndex, modelLoaded, questions]);

  const handleAnswer = (questionId: string, answer: string) => {
    if (submitted) return;
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      Modal.confirm({
        title: '还有未作答的题目',
        content: `您还有 ${unanswered.length} 道题未作答，确定要提交吗？`,
        okText: '确定提交',
        cancelText: '继续答题',
        onOk: () => doSubmit()
      });
    } else {
      doSubmit();
    }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      const answerList = questions.map(q => ({
        questionId: q.id,
        userAnswer: answers[q.id] || ''
      }));

      if (token) {
        try {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

          const response = await fetch(`${baseUrl}/api/quiz/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              courseId,
              publishId,
              answers: answerList
            })
          });

          if (response.ok) {
            const data = await response.json();
            setResult(data);
            setSubmitted(true);
            setShowResult(true);
            message.success('答题结果已保存');
            return;
          }
        } catch (e) {
          console.warn('提交答题结果失败，使用本地计算', e);
        }
      }

      const localResult = calculateLocalResult(answerList);
      setResult(localResult);
      setSubmitted(true);
      setShowResult(true);
      
      if (!token) {
        message.info('游客模式，成绩不会保存');
      }
    } catch (e: any) {
      message.error(e?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateLocalResult = (answerList: { questionId: string; userAnswer: string }[]): QuizResult => {
    const originalQuestions = courseData?.courseData?.questions || [];
    const questionMap = new Map(originalQuestions.map((q: any) => [q.id, q]));
    
    let correctCount = 0;
    const details = answerList.map(ans => {
      const question = questionMap.get(ans.questionId) as any;
      const correct = question && question.answer === ans.userAnswer;
      if (correct) correctCount++;
      
      return {
        questionId: ans.questionId,
        userAnswer: ans.userAnswer,
        correctAnswer: question?.answer || '',
        correct: !!correct,
        explanation: question?.explanation
      };
    });

    const totalQuestions = questions.length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return {
      score,
      correctCount,
      totalQuestions,
      details
    };
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentIndex(0);
    setSubmitted(false);
    setResult(null);
    setShowResult(false);
  };

  const getCurrentQuestionDetail = () => {
    if (!result) return null;
    return result.details.find(d => d.questionId === questions[currentIndex]?.id);
  };

  if (loading) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a0a0a'
      }}>
        <Spin size="large" tip="加载考题中..." />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a0a0a'
      }}>
        <Result
          status="info"
          title="暂无考题"
          subTitle="该课程还没有设置考题"
          extra={<Button type="primary" onClick={onBack}>返回</Button>}
        />
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentDetail = getCurrentQuestionDetail();
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <QuizErrorBoundary>
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      position: 'relative', 
      background: '#0a0a0a',
      overflow: 'hidden'
    }}>
      {/* 移动端横屏提示样式和组件 */}
      <style>{`
        @media screen and (max-width: 768px) and (orientation: portrait) {
          .quiz-landscape-hint { display: flex !important; }
        }
        @media screen and (max-width: 768px) and (orientation: landscape) {
          .quiz-landscape-hint { display: none !important; }
          .quiz-panel { width: 40% !important; max-width: 320px !important; }
          .quiz-panel-header { padding: 10px 14px !important; }
          .quiz-option { padding: 10px 12px !important; }
        }
        @media screen and (min-width: 769px) {
          .quiz-landscape-hint { display: none !important; }
        }
      `}</style>
      
      {isMobile && (
        <div 
          className="quiz-landscape-hint"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.98)',
            zIndex: 9999,
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px'
          }}
        >
          <div style={{ fontSize: '60px' }}>📝</div>
          <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '18px', fontWeight: 600 }}>
            请横屏答题
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px', textAlign: 'center', padding: '0 40px' }}>
            为获得最佳答题体验，请将设备横向放置
          </div>
        </div>
      )}

      {/* 左侧：3D模型视图（始终显示，占2/3） */}
      <div style={{ 
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%'
      }}>
        <PublicThreeDViewer
          ref={viewerRef}
          coursewareData={courseData?.coursewareData}
          width={typeof window !== 'undefined' ? window.innerWidth : 1920}
          height={typeof window !== 'undefined' ? window.innerHeight : 1080}
          onModelLoaded={() => setModelLoaded(true)}
        />
      </div>

      {/* 右侧：毛玻璃答题面板（占1/3宽度） */}
      <div 
        className="quiz-panel"
        style={{ 
          position: 'absolute',
          right: 0,
          top: 0,
          width: isMobile ? '50%' : '380px',
          maxWidth: isMobile ? '340px' : '35%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* 顶部标题栏 */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={onBack}
            style={{ color: 'rgba(255,255,255,0.9)', padding: '4px 8px' }}
          >
            返回
          </Button>
          
          <Space>
            {/* WebXR VR答题按钮 */}
            {modelLoaded && (
              <XRButtonContainer
                xrManager={xrIntegration.xrManager}
                onSessionStart={(mode) => setIsXRMode(true)}
                onSessionEnd={() => setIsXRMode(false)}
              />
            )}
            <div style={{ 
              color: 'rgba(255,255,255,0.6)', 
              fontSize: '13px',
              fontWeight: 500 
            }}>
              {currentIndex + 1} / {questions.length}
            </div>
          </Space>
        </div>

        {/* 进度条 */}
        <div style={{ padding: '12px 20px' }}>
          <Progress 
            percent={progressPercent} 
            strokeColor={{ 
              '0%': '#06b6d4', 
              '100%': '#8b5cf6' 
            }}
            trailColor="rgba(255,255,255,0.1)"
            showInfo={false}
            size="small"
          />
        </div>

        {/* 题目区域 */}
        <div style={{ 
          flex: 1, 
          padding: '0 20px 20px',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* 题目类型标签 */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'white',
              background: currentQuestion.type === 'theory' 
                ? 'linear-gradient(135deg, #10b981, #059669)' 
                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              boxShadow: currentQuestion.type === 'theory'
                ? '0 2px 10px rgba(16, 185, 129, 0.4)'
                : '0 2px 10px rgba(139, 92, 246, 0.4)'
            }}>
              {currentQuestion.type === 'theory' ? '📚 理论题' : '🎯 互动题'}
            </span>
          </div>

          {/* 题目内容 */}
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 500,
            marginBottom: '24px',
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.95)'
          }}>
            {currentIndex + 1}. {currentQuestion.question}
          </div>

          {/* 选项列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentQuestion.options.map((opt) => {
              const isSelected = answers[currentQuestion.id] === opt.key;
              const isCorrect = submitted && currentDetail?.correctAnswer === opt.key;
              const isWrong = submitted && isSelected && !currentDetail?.correct;
              
              let bgColor = 'rgba(255, 255, 255, 0.05)';
              let borderColor = 'rgba(255, 255, 255, 0.1)';
              let textColor = 'rgba(255, 255, 255, 0.9)';
              
              if (submitted) {
                if (isCorrect) {
                  bgColor = 'rgba(16, 185, 129, 0.2)';
                  borderColor = 'rgba(16, 185, 129, 0.6)';
                  textColor = '#10b981';
                } else if (isWrong) {
                  bgColor = 'rgba(239, 68, 68, 0.2)';
                  borderColor = 'rgba(239, 68, 68, 0.6)';
                  textColor = '#ef4444';
                }
              } else if (isSelected) {
                bgColor = 'rgba(59, 130, 246, 0.2)';
                borderColor = 'rgba(59, 130, 246, 0.6)';
                textColor = '#60a5fa';
              }
              
              return (
                <div
                  key={opt.key}
                  onClick={() => !submitted && handleAnswer(currentQuestion.id, opt.key)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: `1.5px solid ${borderColor}`,
                    background: bgColor,
                    cursor: submitted ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseEnter={(e) => {
                    if (!submitted && !isSelected) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!submitted && !isSelected) {
                      e.currentTarget.style.background = bgColor;
                      e.currentTarget.style.borderColor = borderColor;
                    }
                  }}
                >
                  {/* 选项标识 */}
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isSelected || isCorrect || isWrong 
                      ? (isCorrect ? '#10b981' : isWrong ? '#ef4444' : '#3b82f6')
                      : 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isSelected || isCorrect || isWrong ? 'white' : 'rgba(255, 255, 255, 0.6)',
                    flexShrink: 0
                  }}>
                    {submitted && isCorrect ? <CheckCircleOutlined /> : 
                     submitted && isWrong ? <CloseCircleOutlined /> : 
                     opt.key}
                  </div>
                  
                  {/* 选项文本 */}
                  <span style={{ 
                    color: textColor,
                    fontSize: '14px',
                    lineHeight: 1.5,
                    flex: 1
                  }}>
                    {opt.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 答案解析（提交后显示） */}
          {submitted && currentDetail?.explanation && (
            <div style={{
              marginTop: '20px',
              padding: '16px',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '12px',
              borderLeft: '3px solid #3b82f6'
            }}>
              <div style={{ 
                fontWeight: 600, 
                marginBottom: '8px',
                color: '#60a5fa',
                fontSize: '13px'
              }}>
                📖 答案解析
              </div>
              <div style={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '13px',
                lineHeight: 1.6
              }}>
                {currentDetail.explanation}
              </div>
            </div>
          )}
        </div>

        {/* 底部导航 */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* 导航按钮 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Button 
              icon={<LeftOutlined />}
              onClick={handlePrev}
              disabled={currentIndex === 0}
              style={{ 
                flex: 1,
                height: '40px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: currentIndex === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)'
              }}
            >
              上一题
            </Button>

            <Button 
              onClick={handleNext}
              disabled={currentIndex === questions.length - 1}
              style={{ 
                flex: 1,
                height: '40px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: currentIndex === questions.length - 1 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.9)'
              }}
            >
              下一题
              <RightOutlined />
            </Button>
          </div>

          {/* 提交/重试按钮 */}
          {!submitted ? (
            <Button 
              type="primary"
              onClick={handleSubmit}
              loading={submitting}
              style={{ 
                width: '100%',
                height: '44px',
                fontSize: '15px',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
              }}
            >
              提交答题 ({answeredCount}/{questions.length})
            </Button>
          ) : (
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleRetry}
              style={{ 
                width: '100%',
                height: '44px',
                fontSize: '15px',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'rgba(255,255,255,0.9)'
              }}
            >
              重新答题
            </Button>
          )}
        </div>
      </div>

      {/* 成绩结果弹窗 */}
      <Modal
        title={null}
        open={showResult && result !== null}
        footer={null}
        centered
        width={380}
        closable={false}
        styles={{
          mask: { 
            backdropFilter: 'blur(8px)',
            background: 'rgba(0, 0, 0, 0.6)'
          },
          content: {
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }
        }}
      >
        <div style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: result && result.score >= 60 
              ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
              : 'linear-gradient(135deg, #6b7280, #4b5563)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: result && result.score >= 60
              ? '0 8px 30px rgba(251, 191, 36, 0.4)'
              : '0 8px 30px rgba(107, 114, 128, 0.3)'
          }}>
            <TrophyOutlined style={{ 
              fontSize: '40px', 
              color: 'white'
            }} />
          </div>
          
          <div style={{ 
            fontSize: '56px', 
            fontWeight: 700,
            background: result && result.score >= 60 
              ? 'linear-gradient(135deg, #10b981, #06b6d4)'
              : 'linear-gradient(135deg, #ef4444, #f97316)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1.2
          }}>
            {result?.score}<span style={{ fontSize: '24px' }}>分</span>
          </div>
          
          <div style={{ 
            color: 'rgba(255, 255, 255, 0.6)', 
            marginBottom: '24px',
            fontSize: '14px'
          }}>
            共 {result?.totalQuestions} 题，答对 {result?.correctCount} 题
          </div>
          
          <div style={{ 
            padding: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-around'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: 600,
                color: '#10b981'
              }}>
                {result?.correctCount}
              </div>
              <div style={{ 
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '4px'
              }}>
                正确
              </div>
            </div>
            <div style={{ 
              width: '1px',
              background: 'rgba(255, 255, 255, 0.1)'
            }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: 600,
                color: '#ef4444'
              }}>
                {(result?.totalQuestions || 0) - (result?.correctCount || 0)}
              </div>
              <div style={{ 
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '4px'
              }}>
                错误
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button 
              onClick={() => setShowResult(false)}
              style={{ 
                flex: 1,
                height: '44px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'rgba(255,255,255,0.9)'
              }}
            >
              查看详情
            </Button>
            <Button 
              type="primary" 
              onClick={handleRetry}
              style={{ 
                flex: 1,
                height: '44px',
                background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                border: 'none'
              }}
            >
              重新答题
            </Button>
          </div>
          
          <Button 
            type="text" 
            onClick={onBack}
            style={{ 
              marginTop: '12px',
              color: 'rgba(255, 255, 255, 0.5)'
            }}
          >
            返回课程
          </Button>
        </div>
      </Modal>
    </div>
    </QuizErrorBoundary>
  );
}
