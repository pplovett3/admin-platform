"use client";
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// 创建圆形发光粒子纹理
function createGlowParticleTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
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

interface ParticleBackgroundProps {
  particleCount?: number;
  interactive?: boolean;
}

export default function ParticleBackground({ 
  particleCount = 150, 
  interactive = true 
}: ParticleBackgroundProps) {
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
      
      sizes[i] = Math.random() * 20 + 10;

      particles.push(new THREE.Vector3(x, y, z));
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.2
      ));
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // 创建发光球形粒子纹理
    const particleTexture = createGlowParticleTexture();

    // 粒子材质
    const particlesMaterial = new THREE.PointsMaterial({
      size: 22,
      map: particleTexture,
      transparent: true,
      opacity: 0.85,
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
      opacity: 0.1,
      blending: THREE.AdditiveBlending
    });
    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(linesMesh);

    // 鼠标移动处理
    const onMouseMove = (event: MouseEvent) => {
      if (!interactive) return;
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
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
        particles[i].add(velocities[i]);

        // 鼠标影响
        if (interactive) {
          const dist = particles[i].distanceTo(mouseVec);
          if (dist < mouseInfluenceRadius) {
            const force = (mouseInfluenceRadius - dist) / mouseInfluenceRadius;
            const direction = particles[i].clone().sub(mouseVec).normalize();
            particles[i].add(direction.multiplyScalar(force * 1.5));
          }
        }

        // 边界反弹
        if (Math.abs(particles[i].x) > 400) velocities[i].x *= -1;
        if (Math.abs(particles[i].y) > 300) velocities[i].y *= -1;
        if (Math.abs(particles[i].z) > 200) velocities[i].z *= -1;

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

      // 轻微旋转
      particlesMesh.rotation.y += 0.0002;
      particlesMesh.rotation.x += 0.0001;
      linesMesh.rotation.y += 0.0002;
      linesMesh.rotation.x += 0.0001;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      particleTexture.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    };
  }, [particleCount, interactive]);

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
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, #0a1628 0%, #050d18 50%, #020810 100%)'
      }}
    />
  );
}



