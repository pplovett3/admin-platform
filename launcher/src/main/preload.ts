import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 启动应用
  launchApp: (courseId: string, token: string) => 
    ipcRenderer.invoke('launch-app', { courseId, token }),
  
  // 获取课程配置
  getCourseConfig: () => 
    ipcRenderer.invoke('get-course-config'),
  
  // 获取应用版本
  getAppVersion: () => 
    ipcRenderer.invoke('get-app-version')
});

// 类型声明
declare global {
  interface Window {
    electronAPI: {
      launchApp: (courseId: string, token: string) => Promise<{ success: boolean; error?: string }>;
      getCourseConfig: () => Promise<{ success: boolean; config?: any; error?: string }>;
      getAppVersion: () => Promise<string>;
    };
  }
}

