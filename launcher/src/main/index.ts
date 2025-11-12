import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { launchApp, loadCourseConfig, getCourseAppPath } from './launcher';

let mainWindow: BrowserWindow | null = null;

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    center: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'YF课程启动器'
  });

  // 开发环境加载开发服务器，生产环境加载打包后的HTML
  // 检查是否有DEV环境变量来决定是否使用开发服务器
  const isDev = process.env.NODE_ENV === 'development' && process.env.USE_DEV_SERVER === 'true';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:9000');
  } else {
    // 直接加载本地HTML文件
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }
  
  // 始终打开开发者工具方便调试
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用准备就绪
app.whenReady().then(async () => {
  // 预加载课程配置到缓存
  console.log('正在初始化课程配置...');
  await loadCourseConfig();
  console.log('课程配置初始化完成');
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: 启动应用
ipcMain.handle('launch-app', async (event, args: { courseId: string, token: string }) => {
  try {
    const { courseId, token } = args;
    
    // 获取课程应用路径
    const appPath = getCourseAppPath(courseId);
    
    if (!appPath) {
      throw new Error(`未找到课程 ${courseId} 的配置信息`);
    }

    // 启动应用
    await launchApp(appPath, token);
    
    return { success: true };
  } catch (error: any) {
    console.error('Launch app error:', error);
    return { success: false, error: error.message };
  }
});

// IPC: 获取课程配置
ipcMain.handle('get-course-config', async () => {
  try {
    const config = await loadCourseConfig();
    return { success: true, config };
  } catch (error: any) {
    console.error('Get course config error:', error);
    return { success: false, error: error.message };
  }
});

// IPC: 获取应用版本
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

