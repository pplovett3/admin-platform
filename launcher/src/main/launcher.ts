import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { LauncherConfig, CourseConfig } from '../shared/types';

// Windows注册表路径 - YF课程会在这里注册
const REGISTRY_KEY = 'HKLM\\SOFTWARE\\YFCourses';
const USER_REGISTRY_KEY = 'HKCU\\SOFTWARE\\YFCourses';

// 内存缓存课程配置
let cachedCourseConfig: LauncherConfig | null = null;

// 标准安装路径
const STANDARD_INSTALL_PATHS = [
  'C:\\Program Files\\YF Courses',
  'C:\\Program Files (x86)\\YF Courses',
  'D:\\YF Courses',
  'E:\\YF Courses'
];

// 从注册表读取已安装课程（异步版本）
async function loadCoursesFromRegistry(): Promise<CourseConfig[]> {
  try {
    const regedit = require('regedit');
    
    return new Promise((resolve) => {
      const keys = [REGISTRY_KEY, USER_REGISTRY_KEY];
      
      regedit.list(keys, (err: any, result: any) => {
        if (err) {
          console.log('Registry read error (expected if no courses installed):', err.message);
          resolve([]);
          return;
        }

        console.log('Registry list result:', JSON.stringify(result, null, 2));

        const courses: CourseConfig[] = [];
        const promises: Promise<void>[] = [];
        
        // 解析注册表项
        for (const key of keys) {
          if (result[key] && result[key].keys) {
            // keys是数组，不是对象！
            const courseIds = result[key].keys;
            console.log(`Found courseIds in ${key}:`, courseIds);
            
            for (const courseId of courseIds) {
              const coursePath = `${key}\\${courseId}`;
              
              const promise = new Promise<void>((resolveInner) => {
                regedit.list([coursePath], (err2: any, result2: any) => {
                  if (err2) {
                    console.log(`Error reading ${coursePath}:`, err2);
                    resolveInner();
                    return;
                  }
                  
                  console.log(`Registry values for ${courseId}:`, JSON.stringify(result2[coursePath]?.values, null, 2));
                  
                  if (result2[coursePath] && result2[coursePath].values) {
                    const values = result2[coursePath].values;
                    
                    if (values.InstallPath && values.InstallPath.value) {
                      const appPath = values.InstallPath.value;
                      const name = values.CourseName?.value || courseId;
                      
                      console.log(`Checking path: ${appPath}`);
                      
                      // 验证路径存在
                      if (fs.existsSync(appPath)) {
                        console.log(`✓ 路径存在，添加课程: ${courseId}`);
                        courses.push({
                          courseId,
                          appPath,
                          name
                        });
                      } else {
                        console.log(`✗ 路径不存在: ${appPath}`);
                      }
                    }
                  }
                  resolveInner();
                });
              });
              
              promises.push(promise);
            }
          }
        }
        
        // 等待所有注册表项读取完成
        Promise.all(promises).then(() => {
          console.log(`Async registry read complete: found ${courses.length} courses`);
          resolve(courses);
        });
      });
    });
  } catch (error) {
    console.log('Registry module not available, skipping registry check');
    return [];
  }
}

// 从注册表读取已安装课程（同步版本 - 使用阻塞IO）
function loadCoursesFromRegistrySync(): CourseConfig[] {
  const courses: CourseConfig[] = [];
  
  try {
    // 直接查询每个可能的课程ID路径
    // 由于我们不知道有哪些courseId，先尝试列出所有子键
    const listResult = execSync(`reg query "${REGISTRY_KEY.replace(/\\\\/g, '\\')}"`, {
      encoding: 'utf-8',
      windowsHide: true
    });
    
    // 解析子键列表，获取所有courseId
    const lines = listResult.split('\n');
    const courseIds: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // 匹配形如: HKEY_LOCAL_MACHINE\SOFTWARE\YFCourses\690af61251fc83dcf5a7d37d
      if (trimmed.startsWith('HKEY_') && trimmed.includes('YFCourses\\')) {
        const parts = trimmed.split('\\');
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart !== 'YFCourses') {
          courseIds.push(lastPart);
        }
      }
    }
    
    // 对每个courseId，单独查询其值
    for (const courseId of courseIds) {
      try {
        const coursePath = `${REGISTRY_KEY}\\${courseId}`;
        const valueResult = execSync(`reg query "${coursePath.replace(/\\\\/g, '\\')}" /v InstallPath`, {
          encoding: 'utf-8',
          windowsHide: true
        });
        
        // 解析InstallPath值
        const installPathMatch = valueResult.match(/InstallPath\s+REG_SZ\s+(.+)/);
        if (installPathMatch) {
          const appPath = installPathMatch[1].trim();
          
          // 验证路径存在
          if (fs.existsSync(appPath)) {
            // 尝试获取CourseName
            let name = courseId;
            try {
              const nameResult = execSync(`reg query "${coursePath.replace(/\\\\/g, '\\')}" /v CourseName`, {
                encoding: 'utf-8',
                windowsHide: true
              });
              const nameMatch = nameResult.match(/CourseName\s+REG_SZ\s+(.+)/);
              if (nameMatch) {
                name = nameMatch[1].trim();
              }
            } catch (e) {
              // CourseName可选，忽略错误
            }
            
            courses.push({
              courseId,
              appPath,
              name
            });
            
            console.log(`✓ 从注册表读取课程: ${courseId} -> ${appPath}`);
          } else {
            console.log(`✗ 课程路径不存在: ${appPath}`);
          }
        }
      } catch (error) {
        console.log(`查询课程 ${courseId} 失败:`, error);
      }
    }
  } catch (error) {
    console.log('Registry sync read error:', error);
  }
  
  console.log(`注册表同步读取完成，找到 ${courses.length} 门课程`);
  return courses;
}

// 扫描标准安装路径
function scanStandardPaths(): CourseConfig[] {
  const courses: CourseConfig[] = [];
  
  for (const basePath of STANDARD_INSTALL_PATHS) {
    if (!fs.existsSync(basePath)) continue;
    
    try {
      const entries = fs.readdirSync(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const courseDir = path.join(basePath, entry.name);
        const configFile = path.join(courseDir, 'course.json');
        
        // 查找course.json配置文件
        if (fs.existsSync(configFile)) {
          try {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            
            if (config.courseId && config.executable) {
              const appPath = path.join(courseDir, config.executable);
              
              if (fs.existsSync(appPath)) {
                courses.push({
                  courseId: config.courseId,
                  appPath,
                  name: config.name || entry.name
                });
              }
            }
          } catch (error) {
            console.log(`Failed to parse ${configFile}:`, error);
          }
        }
      }
    } catch (error) {
      console.log(`Failed to scan ${basePath}:`, error);
    }
  }
  
  return courses;
}

// 读取手动配置文件
function loadManualConfig(): LauncherConfig {
  try {
    const configPath = path.join(process.cwd(), 'courses.json');
    
    if (!fs.existsSync(configPath)) {
      return { courses: [] };
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config: LauncherConfig = JSON.parse(configContent);
    
    return config;
  } catch (error) {
    console.error('Failed to load manual config:', error);
    return { courses: [] };
  }
}

// 合并并去重课程配置
function mergeCourseConfigs(configs: CourseConfig[][]): CourseConfig[] {
  const courseMap = new Map<string, CourseConfig>();
  
  // 按优先级合并：注册表 > 标准路径 > 手动配置
  for (const configList of configs) {
    for (const course of configList) {
      if (!courseMap.has(course.courseId)) {
        courseMap.set(course.courseId, course);
      }
    }
  }
  
  return Array.from(courseMap.values());
}

// 读取课程配置（整合所有来源）
export async function loadCourseConfig(): Promise<LauncherConfig> {
  try {
    console.log('🔍 开始自动检测已安装课程...');
    
    // 1. 从注册表读取
    console.log('📋 检查注册表...');
    const registryCourses = await loadCoursesFromRegistry();
    console.log(`  ✓ 注册表发现 ${registryCourses.length} 门课程`);
    
    // 2. 扫描标准路径
    console.log('📂 扫描标准安装路径...');
    const scannedCourses = scanStandardPaths();
    console.log(`  ✓ 标准路径发现 ${scannedCourses.length} 门课程`);
    
    // 3. 读取手动配置
    console.log('📝 读取手动配置...');
    const manualConfig = loadManualConfig();
    console.log(`  ✓ 手动配置 ${manualConfig.courses.length} 门课程`);
    
    // 合并所有来源
    const allCourses = mergeCourseConfigs([
      registryCourses,
      scannedCourses,
      manualConfig.courses
    ]);
    
    console.log(`✅ 总共发现 ${allCourses.length} 门可用课程`);
    
    // 更新缓存
    cachedCourseConfig = { courses: allCourses };
    
    return { courses: allCourses };
  } catch (error) {
    console.error('Failed to load course config:', error);
    return { courses: [] };
  }
}

// 同步版本（用于IPC快速响应）
export function loadCourseConfigSync(): LauncherConfig {
  const registryCourses = loadCoursesFromRegistrySync();
  const manualConfig = loadManualConfig();
  const scannedCourses = scanStandardPaths();
  
  const allCourses = mergeCourseConfigs([
    registryCourses,
    scannedCourses,
    manualConfig.courses
  ]);
  
  return { courses: allCourses };
}

// 查找课程配置（使用缓存）
export function findCourseConfig(courseId: string): CourseConfig | null {
  // 优先使用缓存
  if (cachedCourseConfig) {
    const course = cachedCourseConfig.courses.find(c => c.courseId === courseId);
    if (course) {
      console.log(`从缓存找到课程: ${courseId} -> ${course.appPath}`);
      return course;
    }
  }
  
  // 缓存不存在，使用同步方法（降级方案）
  console.log('缓存未命中，使用同步方法查找课程');
  const config = loadCourseConfigSync();
  const course = config.courses.find(c => c.courseId === courseId);
  return course || null;
}

// 验证应用路径是否存在
export function validateAppPath(appPath: string): boolean {
  try {
    return fs.existsSync(appPath);
  } catch (error) {
    console.error('Failed to validate app path:', error);
    return false;
  }
}

// 启动应用
export function launchApp(appPath: string, token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 验证应用路径
      if (!validateAppPath(appPath)) {
        reject(new Error(`应用不存在: ${appPath}`));
        return;
      }

      console.log('Launching app:', appPath);
      console.log('Token:', token.substring(0, 20) + '...');

      // 判断是否是bat文件
      const isBatchFile = appPath.toLowerCase().endsWith('.bat');
      
      let child;
      if (isBatchFile) {
        // bat文件需要通过cmd.exe启动，保持窗口可见
        child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', appPath, `--token=${token}`], {
          detached: true,
          stdio: 'ignore',
          shell: false
        });
      } else {
        // exe文件直接启动
        child = spawn(appPath, [`--token=${token}`], {
          detached: true,
          stdio: 'ignore'
        });
      }

      // 解除父进程引用，让应用独立运行
      child.unref();

      console.log('App launched successfully');
      resolve();
    } catch (error) {
      console.error('Failed to launch app:', error);
      reject(error);
    }
  });
}

// 获取课程应用路径
export function getCourseAppPath(courseId: string): string | null {
  const courseConfig = findCourseConfig(courseId);
  return courseConfig ? courseConfig.appPath : null;
}

