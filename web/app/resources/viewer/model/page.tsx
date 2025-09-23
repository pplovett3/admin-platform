"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Alert } from "antd";
import { getToken } from "../../../_lib/api";

export const dynamic = 'force-dynamic';

function Inner() {
  const sp = useSearchParams();
  const src = sp.get('src') || '';
  const [ready, setReady] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [expectAuthFetch, setExpectAuthFetch] = useState<boolean>(false);
  const canRender = ready && (!expectAuthFetch || !!blobUrl);

  useEffect(()=>{
    if (typeof window !== 'undefined' && (window as any).customElements?.get('model-viewer')) {
      setReady(true);
      return;
    }
    const existed = document.querySelector('script[data-model-viewer]');
    if (existed) { setReady(true); return; }
    
    // 尝试多个版本，从最稳定版本开始
    const versions = [
      'https://unpkg.com/@google/model-viewer@3.4.0/dist/model-viewer.min.js', // 稳定版本
      'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js', // 最新版本
      'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.4.0/dist/model-viewer.min.js' // 备用CDN
    ];
    
    let currentVersionIndex = 0;
    
    function tryLoadVersion() {
      if (currentVersionIndex >= versions.length) {
        setErr('无法加载model-viewer组件，请检查网络连接');
        return;
      }
      
      const s = document.createElement('script');
      s.type = 'module';
      s.src = versions[currentVersionIndex];
      s.setAttribute('data-model-viewer', '1');
      
      s.onload = () => {
        console.log(`Model viewer loaded successfully from: ${versions[currentVersionIndex]}`);
        setReady(true);
      };
      
      s.onerror = () => {
        console.warn(`Failed to load model viewer from: ${versions[currentVersionIndex]}`);
        currentVersionIndex++;
        setTimeout(tryLoadVersion, 100);
      };
      
      document.head.appendChild(s);
    }
    
    tryLoadVersion();
  },[]);

  useEffect(()=>{
    setErr("");
    setBlobUrl("");
    if (!src) return;
    try {
      const url = new URL(src, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
      const isApiDownload = /\/api\/files\/.+\/download/i.test(url.pathname);
      if (isApiDownload) {
        setExpectAuthFetch(true);
        const token = getToken();
        (async()=>{
          try {
            const res = await fetch(url.toString(), { headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
            if (!res.ok) {
              let msg = `下载失败: ${res.status}`;
              try { const j = await res.json(); if ((j as any)?.message) msg = (j as any).message; } catch {}
              throw new Error(msg);
            }
            const blob = await res.blob();
            
            // 基本的GLB文件验证
            if (blob.size < 20) {
              throw new Error('文件太小，可能不是有效的GLB文件');
            }
            
            // 检查GLB文件头（前4字节应该是'glTF'）
            const arrayBuffer = await blob.arrayBuffer();
            const header = new Uint8Array(arrayBuffer, 0, 4);
            const magic = String.fromCharCode(...header);
            
            if (magic !== 'glTF') {
              throw new Error(`无效的GLB文件格式。文件头: ${magic}，期望: glTF`);
            }
            
            // 检查版本（字节5-8，应该是2）
            const version = new DataView(arrayBuffer, 4, 4).getUint32(0, true);
            if (version !== 2) {
              throw new Error(`不支持的GLB版本: ${version}，仅支持版本2`);
            }
            
            console.log(`GLB文件验证通过: 大小${blob.size}字节, 版本${version}`);
            
            // 额外的GLB结构检查
            try {
              const totalLength = new DataView(arrayBuffer, 8, 4).getUint32(0, true);
              if (totalLength !== arrayBuffer.byteLength) {
                console.warn(`GLB文件长度不匹配: 声明${totalLength}字节, 实际${arrayBuffer.byteLength}字节`);
              }
              
              // 检查JSON块
              const jsonChunkLength = new DataView(arrayBuffer, 12, 4).getUint32(0, true);
              const jsonChunkType = new DataView(arrayBuffer, 16, 4).getUint32(0, true);
              
              if (jsonChunkType !== 0x4E4F534A) { // 'JSON'
                console.warn('GLB文件缺少有效的JSON块');
              }
              
              console.log(`GLB结构检查: JSON块大小${jsonChunkLength}字节`);
            } catch (structError) {
              console.warn('GLB结构检查失败:', structError);
            }
            
            const objectUrl = URL.createObjectURL(blob);
            setBlobUrl(objectUrl);
          } catch(e:any){ setErr(e?.message||'下载失败'); }
        })();
      } else {
        setExpectAuthFetch(false);
        setBlobUrl("");
      }
    } catch(e:any){ setErr(e?.message||'URL 解析失败'); }
    return () => { if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch {} } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (!src) return <Alert type="error" message="缺少模型地址 src" />

  return (
    <Card title="模型预览 (GLB)">
      {!ready && <Alert type="info" message="正在加载组件..." />}
      {err && <Alert type="error" message={err} />}
      {canRender && (
        // @ts-ignore: web component
        <model-viewer src={expectAuthFetch ? blobUrl : (blobUrl || src)}
          crossorigin="anonymous"
          style={{ width: '100%', height: '70vh', background: '#111' }}
          camera-controls
          exposure="1"
          shadow-intensity="1"
          autoplay
          onError={(e: any) => {
            console.error('Model viewer error:', e);
            let errorMessage = '模型加载失败';
            
            // 根据不同错误类型提供具体建议
            if (e.detail?.type === 'webgl-error' || e.message?.includes('RangeError')) {
              errorMessage = '模型数据异常（如纹理坐标索引不连续）。建议使用Blender重新导出GLB文件，确保UV映射正确。';
            } else if (e.detail?.type === 'invalid-format') {
              errorMessage = 'GLB文件格式错误。请检查文件是否损坏或使用有效的GLB导出器。';
            } else {
              errorMessage = `模型加载失败: ${e.detail?.type || e.message || '未知错误'}。可能原因：文件损坏、格式不支持或数据异常。`;
            }
            
            setErr(errorMessage);
          }}
          onLoad={() => {
            console.log('Model loaded successfully');
            setErr(''); // 清除之前的错误
          }}
        ></model-viewer>
      )}
      {expectAuthFetch && !blobUrl && !err && <Alert type="info" message="正在下载模型..." />}
    </Card>
  );
}

export default function ModelViewerPage() {
  return (
    <Suspense fallback={<Alert type="info" message="正在解析参数..." />}> 
      <Inner />
    </Suspense>
  );
}
