"use client";
import { App, Button, Card, Form, Input, Radio } from 'antd';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/app/_utils/api';
import { useEffect, useRef, useState } from 'react';
import { parseJwt } from '@/app/_utils/auth';
import * as THREE from 'three';
import Link from 'next/link';

type LoginResp = { token: string };

// 登录目标类型
type LoginTarget = 'admin' | 'editor';

// 创建圆形发光粒子纹理
function createGlowParticleTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  // 创建径向渐变实现球形辉光效果
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.1, 'rgba(200, 255, 255, 0.9)');
  gradient.addColorStop(0.3, 'rgba(100, 220, 255, 0.6)');
  gradient.addColorStop(0.5, 'rgba(50, 180, 255, 0.3)');
  gradient.addColorStop(0.7, 'rgba(30, 150, 255, 0.1)');
  gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// 科技粒子网络背景组件
function ParticleNetworkBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 创建场景
    const scene = new THREE.Scene();
    
    // 创建相机
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 300;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 粒子参数
    const particleCount = 180;
    const particles: THREE.Vector3[] = [];
    const velocities: THREE.Vector3[] = [];
    const connectionDistance = 120;
    const mouseInfluenceRadius = 150;

    // 创建粒子几何体
    const particlesGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // 初始化粒子位置和速度
    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 800;
      const y = (Math.random() - 0.5) * 600;
      const z = (Math.random() - 0.5) * 400;
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      // 随机大小
      sizes[i] = Math.random() * 20 + 10;

      particles.push(new THREE.Vector3(x, y, z));
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.3
      ));
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // 创建发光球形粒子纹理
    const particleTexture = createGlowParticleTexture();

    // 粒子材质 - 使用发光纹理
    const particlesMaterial = new THREE.PointsMaterial({
      size: 25,
      map: particleTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
      color: new THREE.Color(0x66e0ff)
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // 连线
    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending
    });
    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(linesMesh);

    // 鼠标移动处理
    const onMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / width) * 2 - 1;
      mouseRef.current.y = -(event.clientY / height) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    // 窗口大小变化处理
    const onResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', onResize);

    // 动画循环
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const positionAttr = particlesGeometry.getAttribute('position') as THREE.BufferAttribute;
      const posArray = positionAttr.array as Float32Array;

      // 鼠标3D位置
      const mouseVec = new THREE.Vector3(
        mouseRef.current.x * 400,
        mouseRef.current.y * 300,
        0
      );

      // 更新粒子位置
      for (let i = 0; i < particleCount; i++) {
        // 基础运动
        particles[i].add(velocities[i]);

        // 鼠标影响
        const dist = particles[i].distanceTo(mouseVec);
        if (dist < mouseInfluenceRadius) {
          const force = (mouseInfluenceRadius - dist) / mouseInfluenceRadius;
          const direction = particles[i].clone().sub(mouseVec).normalize();
          particles[i].add(direction.multiplyScalar(force * 2));
        }

        // 边界反弹
        if (Math.abs(particles[i].x) > 400) velocities[i].x *= -1;
        if (Math.abs(particles[i].y) > 300) velocities[i].y *= -1;
        if (Math.abs(particles[i].z) > 200) velocities[i].z *= -1;

        // 更新位置数组
        posArray[i * 3] = particles[i].x;
        posArray[i * 3 + 1] = particles[i].y;
        posArray[i * 3 + 2] = particles[i].z;
      }
      positionAttr.needsUpdate = true;

      // 更新连线
      const linePositions: number[] = [];
      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const dist = particles[i].distanceTo(particles[j]);
          if (dist < connectionDistance) {
            linePositions.push(
              particles[i].x, particles[i].y, particles[i].z,
              particles[j].x, particles[j].y, particles[j].z
            );
          }
        }
      }
      lineGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(linePositions, 3)
      );

      // 轻微旋转整个场景
      particlesMesh.rotation.y += 0.0003;
      particlesMesh.rotation.x += 0.0001;
      linesMesh.rotation.y += 0.0003;
      linesMesh.rotation.x += 0.0001;

      renderer.render(scene, camera);
    };

    animate();

    // 清理函数
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      container.removeChild(renderer.domElement);
      renderer.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      particleTexture.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        background: 'radial-gradient(ellipse at center, #0a1628 0%, #050d18 50%, #020810 100%)'
      }}
    />
  );
}

export default function LoginPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const [loginTarget, setLoginTarget] = useState<LoginTarget>('admin');

  const onFinish = async (values: any) => {
    try {
      const resp = await apiPost<LoginResp>('/api/auth/login', values);
      const token = resp.token;
      
      // 解析 JWT 获取角色信息
      const payload = parseJwt(token);
      
      // 学生不允许登录此入口
      if (payload?.role === 'student') {
        message.error('学生账号请从课程门户登录');
        return;
      }
      
      localStorage.setItem('token', token);
      
      // 根据选择跳转到对应模块
      if (loginTarget === 'editor') {
        router.push('/editor');
      } else {
        router.push('/admin/analytics');
      }
    } catch (e: any) {
      message.error(e?.message || '登录失败');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      gap: 32
    }}>
      {/* 粒子网络背景 */}
      <ParticleNetworkBackground />
      
      {/* 平台标题 */}
      <div style={{
        zIndex: 10,
        textAlign: 'center',
        position: 'relative'
      }}>
        <h1 style={{
          fontSize: 42,
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: 6,
          margin: 0,
          textShadow: '0 0 40px rgba(34, 211, 238, 0.5), 0 0 80px rgba(34, 211, 238, 0.3)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
        }}>
          CollabXR平台
        </h1>
        <p style={{
          fontSize: 14,
          color: 'rgba(148, 163, 184, 0.8)',
          marginTop: 8,
          letterSpacing: 2
        }}>
          协作式混合现实内容管理系统
        </p>
      </div>
      
      {/* 液态玻璃登录卡片 */}
      <Card 
        style={{ 
          width: 420, 
          borderRadius: 24,
          // 液态玻璃效果
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.05) 100%)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          // 多层边框模拟液态玻璃的光泽
          border: '1px solid rgba(255, 255, 255, 0.18)',
          boxShadow: `
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 1px rgba(255, 255, 255, 0.15),
            inset 0 -1px 1px rgba(0, 0, 0, 0.1),
            0 0 0 1px rgba(255, 255, 255, 0.05)
          `,
          zIndex: 10,
          position: 'relative',
          overflow: 'hidden'
        }} 
        styles={{ body: { padding: 36 } }}
      >
        {/* 顶部高光渐变 - 模拟液态玻璃的光泽 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 100%)',
          pointerEvents: 'none',
          borderRadius: '24px 24px 0 0'
        }} />
        
        {/* 边缘光晕 */}
        <div style={{
          position: 'absolute',
          top: -1,
          left: '20%',
          right: '20%',
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
          borderRadius: 2
        }} />
        
        <div style={{ 
          fontSize: 20, 
          fontWeight: 600, 
          marginBottom: 24, 
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.95)',
          letterSpacing: 4,
          position: 'relative'
        }}>
          管理员登录
        </div>
        
        <Form layout="vertical" onFinish={onFinish}>
          {/* 登录目标选择 */}
          <Form.Item 
            label={<span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 13 }}>登录目标</span>}
          >
            <Radio.Group 
              value={loginTarget} 
              onChange={(e) => setLoginTarget(e.target.value)}
              style={{ width: '100%' }}
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <div 
                  onClick={() => setLoginTarget('admin')}
                  style={{
                    flex: 1,
                    padding: '16px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: loginTarget === 'admin' 
                      ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: loginTarget === 'admin'
                      ? '1px solid rgba(34, 211, 238, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Radio value="admin" style={{ width: '100%' }}>
                    <div style={{ color: '#fff', marginLeft: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>管理后台</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                        数据分析、用户管理、课程审核
                      </div>
                    </div>
                  </Radio>
                </div>
                <div 
                  onClick={() => setLoginTarget('editor')}
                  style={{
                    flex: 1,
                    padding: '16px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: loginTarget === 'editor' 
                      ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.15) 100%)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: loginTarget === 'editor'
                      ? '1px solid rgba(139, 92, 246, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Radio value="editor" style={{ width: '100%' }}>
                    <div style={{ color: '#fff', marginLeft: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>三维编辑器</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                        资源管理、课件创作、AI课程
                      </div>
                    </div>
                  </Radio>
                </div>
              </div>
            </Radio.Group>
          </Form.Item>

          <Form.Item 
            label={<span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 13 }}>手机号</span>} 
            name="phone" 
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input 
              size="large" 
              placeholder="请输入手机号" 
              allowClear 
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                height: 48,
                color: '#fff'
              }}
            />
          </Form.Item>
          <Form.Item 
            label={<span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 13 }}>密码</span>} 
            name="password" 
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              size="large" 
              placeholder="请输入密码"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                height: 48
              }}
            />
          </Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            block 
            size="large"
            style={{
              marginTop: 12,
              height: 52,
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 4,
              // 液态玻璃风格的按钮
              background: loginTarget === 'admin'
                ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.9) 0%, rgba(6, 182, 212, 0.85) 100%)'
                : 'linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(124, 58, 237, 0.85) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: loginTarget === 'admin'
                ? '0 4px 24px rgba(34, 211, 238, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
                : '0 4px 24px rgba(139, 92, 246, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.3)'
            }}
          >
            登 录
          </Button>
        </Form>

        {/* 学生入口提示 */}
        <div style={{ 
          marginTop: 24, 
          textAlign: 'center',
          paddingTop: 20,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13 }}>
            学生用户？
          </span>
          <Link 
            href="/portal/login" 
            style={{ 
              color: 'rgba(34, 211, 238, 0.9)', 
              marginLeft: 8,
              fontSize: 13,
              textDecoration: 'none'
            }}
          >
            前往课程门户登录
          </Link>
        </div>
      </Card>
    </div>
  );
}
