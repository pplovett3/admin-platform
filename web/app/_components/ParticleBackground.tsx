"use client";
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// 主题颜色预设
export type ThemeColor = 'cyan' | 'purple' | 'green';

const THEME_COLORS = {
  cyan: {
    particle: 0x66e0ff,
    line: 0x22d3ee,
    nebulaBase: '#001133',
    nebulaColors: ['#003366', '#0066aa', '#004488'],
    glowStops: [
      { pos: 0, color: 'rgba(255, 255, 255, 1)' },
      { pos: 0.1, color: 'rgba(200, 255, 255, 0.9)' },
      { pos: 0.3, color: 'rgba(100, 220, 255, 0.6)' },
      { pos: 0.5, color: 'rgba(50, 180, 255, 0.3)' },
      { pos: 0.7, color: 'rgba(30, 150, 255, 0.1)' },
      { pos: 1, color: 'rgba(0, 100, 255, 0)' },
    ],
  },
  purple: {
    particle: 0xc084fc,
    line: 0x8b5cf6,
    nebulaBase: '#110033',
    nebulaColors: ['#330066', '#6600aa', '#440088'],
    glowStops: [
      { pos: 0, color: 'rgba(255, 255, 255, 1)' },
      { pos: 0.1, color: 'rgba(220, 200, 255, 0.9)' },
      { pos: 0.3, color: 'rgba(180, 140, 255, 0.6)' },
      { pos: 0.5, color: 'rgba(139, 92, 246, 0.3)' },
      { pos: 0.7, color: 'rgba(124, 58, 237, 0.1)' },
      { pos: 1, color: 'rgba(91, 33, 182, 0)' },
    ],
  },
  green: {
    particle: 0x6ee7b7,
    line: 0x10b981,
    nebulaBase: '#001111',
    nebulaColors: ['#003333', '#006655', '#004444'],
    glowStops: [
      { pos: 0, color: 'rgba(255, 255, 255, 1)' },
      { pos: 0.1, color: 'rgba(200, 255, 220, 0.9)' },
      { pos: 0.3, color: 'rgba(110, 231, 183, 0.6)' },
      { pos: 0.5, color: 'rgba(52, 211, 153, 0.3)' },
      { pos: 0.7, color: 'rgba(16, 185, 129, 0.1)' },
      { pos: 1, color: 'rgba(5, 150, 105, 0)' },
    ],
  },
};

// 简单的 Perlin Noise 实现
const perm = new Uint8Array(512);
const p = new Uint8Array(256);
for (let i = 0; i < 256; i++) p[i] = i;
for (let i = 0; i < 256; i++) {
  const r = i + ~~(Math.random() * (256 - i));
  const t = p[i]; p[i] = p[r]; p[r] = t;
}
for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t: number, a: number, b: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number, z: number) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function noise(x: number, y: number, z: number) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return lerp(w, lerp(v, lerp(u, grad(perm[AA], x, y, z),
    grad(perm[BA], x - 1, y, z)),
    lerp(u, grad(perm[AB], x, y - 1, z),
      grad(perm[BB], x - 1, y - 1, z))),
    lerp(v, lerp(u, grad(perm[AA + 1], x, y, z - 1),
      grad(perm[BA + 1], x - 1, y, z - 1)),
      lerp(u, grad(perm[AB + 1], x, y - 1, z - 1),
        grad(perm[BB + 1], x - 1, y - 1, z - 1))));
}

// 创建圆形发光粒子纹理
function createGlowParticleTexture(theme: ThemeColor): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  const themeColors = THEME_COLORS[theme];
  themeColors.glowStops.forEach(stop => {
    gradient.addColorStop(stop.pos, stop.color);
  });
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// 创建更细腻的星云纹理
function createNebulaTexture(theme: ThemeColor): THREE.Texture {
  const width = 1024;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  const themeColors = THEME_COLORS[theme];
  
  // 使用 FBM (Fractal Brownian Motion) 生成云雾
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  
  const scale = 0.003;
  const octaves = 5;
  const persistence = 0.5;
  const baseColor = new THREE.Color(themeColors.nebulaBase);
  const colors = themeColors.nebulaColors.map(c => new THREE.Color(c));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxValue = 0;
      
      for (let i = 0; i < octaves; i++) {
        value += noise(x * scale * frequency, y * scale * frequency, i * 10.5) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2;
      }
      
      value = value / maxValue;
      value = (value + 1) * 0.5; // Normalize to 0-1
      
      // 增加对比度，让云雾更明显但柔和
      value = Math.pow(value, 1.5);
      
      // 颜色混合
      let r: number, g: number, b: number, alpha: number;
      
      // 边缘渐变透明
      const distToCenter = Math.sqrt(Math.pow(x - width/2, 2) + Math.pow(y - height/2, 2));
      const maxDist = width * 0.72;
      let mask = 1 - Math.min(1, distToCenter / maxDist);
      mask = mask * mask * (3 - 2 * mask); // Smoothstep

      // 额外一层噪声用于“色彩扰动”，避免出现硬色带
      const n2 = noise(x * scale * 2.1, y * scale * 2.1, 99.1); // [-1, 1]
      const n3 = noise(x * scale * 3.7, y * scale * 3.7, 199.7); // [-1, 1]
      const jitter = (n2 * 0.5 + 0.5 - 0.5) * 0.22; // [-0.11, 0.11]

      // 连续渐变：base -> c0 -> c1 -> c2（避免分段色带）
      const t0 = Math.min(1, Math.max(0, (value - 0.18) / 0.82 + jitter));
      const s = t0 * t0 * (3 - 2 * t0); // smoothstep

      // 3 段插值：0~0.5: c0->c1, 0.5~1: c1->c2
      let col = colors[0].clone();
      if (s < 0.5) {
        const tt = (s * 2);
        const ss = tt * tt * (3 - 2 * tt);
        col = colors[0].clone().lerp(colors[1], ss);
      } else {
        const tt = (s - 0.5) * 2;
        const ss = tt * tt * (3 - 2 * tt);
        col = colors[1].clone().lerp(colors[2], ss);
      }

      // 边缘更暗，中心更亮，营造深邃感
      const edgeDarken = 0.22 * (1 - mask);
      col.lerp(baseColor, edgeDarken);

      // 细丝高光（类似“星云纤维”）：用 ridged noise 提亮一小部分区域
      const ridged = 1 - Math.abs(n3); // [0,1]
      const filament = Math.pow(ridged, 5) * 0.9; // 更尖锐的细丝

      r = col.r * 255;
      g = col.g * 255;
      b = col.b * 255;

      // alpha：云雾为主、细丝为辅；避免过亮导致“糊一片”
      const cloudAlpha = 255 * mask * (0.04 + 0.55 * Math.pow(value, 1.25));
      const filamentAlpha = 255 * mask * (0.18 * filament);
      alpha = Math.min(220, cloudAlpha + filamentAlpha);
      
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = alpha;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);

  // 叠加几层“模糊云团”来提升层次（解决“看起来粗糙/平”的问题）
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = 'blur(22px)';
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = 160 + Math.random() * 520;
    const cA = colors[Math.floor(Math.random() * colors.length)];
    const cB = colors[Math.floor(Math.random() * colors.length)];
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(${Math.floor(cA.r * 255)}, ${Math.floor(cA.g * 255)}, ${Math.floor(cA.b * 255)}, 0.10)`);
    g.addColorStop(0.55, `rgba(${Math.floor(cB.r * 255)}, ${Math.floor(cB.g * 255)}, ${Math.floor(cB.b * 255)}, 0.06)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  // 少量星尘（白色点缀更自然）
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const a = Math.random() < 0.02 ? 0.22 : 0.06;
    const s = Math.random() < 0.02 ? 1.6 : 0.9;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalCompositeOperation = 'source-over';
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

interface ParticleBackgroundProps {
  particleCount?: number;
  interactive?: boolean;
  theme?: ThemeColor;
}

export default function ParticleBackground({ 
  particleCount = 150, 
  interactive = true,
  theme = 'cyan'
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const themeColors = THEME_COLORS[theme];

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
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    // === 星云背景 ===
    const nebulaTexture = createNebulaTexture(theme);
    // 使用巨大平面覆盖视野
    const nebulaGeometry = new THREE.PlaneGeometry(6000, 6000);
    const nebulaMaterial = new THREE.MeshBasicMaterial({
      map: nebulaTexture,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending, // 叠加混合模式让光感更强
      side: THREE.DoubleSide,
      depthWrite: false, // 不写入深度缓冲，作为背景
    });
    const nebulaMesh = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    nebulaMesh.position.z = -300;
    scene.add(nebulaMesh);

    // === 远景星星 ===
    const starCount = 400;
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
      // 在更大的空间内随机分布星星
      starPositions[i * 3] = (Math.random() - 0.5) * 2000;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 1500;
      starPositions[i * 3 + 2] = -200 - Math.random() * 400;
      starSizes[i] = Math.random() * 2.5 + 0.5;
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const starsMesh = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starsMesh);

    // === 主粒子网络 ===
    const particles: THREE.Vector3[] = [];
    const velocities: THREE.Vector3[] = [];
    const connectionDistance = 120;
    const mouseInfluenceRadius = 150;

    const particlesGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

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

    const particleTexture = createGlowParticleTexture(theme);

    const particlesMaterial = new THREE.PointsMaterial({
      size: 22,
      map: particleTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false,
      color: new THREE.Color(themeColors.particle)
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // 连线
    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({
      color: themeColors.line,
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
    let time = 0;
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.003; // 稍微减慢时间流逝，让星云流动更优雅

      // 星云极缓慢旋转和缩放，模拟宇宙膨胀
      nebulaMesh.rotation.z = Math.sin(time * 0.1) * 0.05;
      nebulaMesh.scale.set(
        1.2 + Math.sin(time * 0.2) * 0.05,
        1.2 + Math.cos(time * 0.2) * 0.05,
        1
      );

      // 星星闪烁
      const starSizeAttr = starsGeometry.getAttribute('size') as THREE.BufferAttribute;
      const starSizeArray = starSizeAttr.array as Float32Array;
      for (let i = 0; i < starCount; i++) {
        starSizeArray[i] = (starSizes[i] + Math.sin(time * 2 + i) * 0.8) * 0.8 + 0.2;
      }
      starSizeAttr.needsUpdate = true;

      const positionAttr = particlesGeometry.getAttribute('position') as THREE.BufferAttribute;
      const posArray = positionAttr.array as Float32Array;

      const mouseVec = new THREE.Vector3(
        mouseRef.current.x * 400,
        mouseRef.current.y * 300,
        0
      );

      // 更新粒子位置
      for (let i = 0; i < particleCount; i++) {
        particles[i].add(velocities[i]);

        if (interactive) {
          const dist = particles[i].distanceTo(mouseVec);
          if (dist < mouseInfluenceRadius) {
            const force = (mouseInfluenceRadius - dist) / mouseInfluenceRadius;
            const direction = particles[i].clone().sub(mouseVec).normalize();
            particles[i].add(direction.multiplyScalar(force * 1.5));
          }
        }

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
      nebulaGeometry.dispose();
      nebulaMaterial.dispose();
      nebulaTexture.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
    };
  }, [particleCount, interactive, theme]);

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
        background: '#020810'
      }}
    />
  );
}
