; ========================================
; YF课程启动器 - Unity应用安装脚本模板
; ========================================
; 使用说明：
; 1. 修改下方的配置信息（CourseId、路径等）
; 2. 用Inno Setup打开此文件
; 3. 点击编译（Ctrl+F9）
; 4. 生成安装程序
; ========================================

; ============ 必须修改的配置 ============

; 课程信息（从管理后台获取）
#define MyAppName "Unity启动测试课程"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "YF"
#define MyAppExeName "Untiy_StarterTest.exe"

; ⚠️ 重要：CourseId必须与数据库中的课程ID完全一致！
; 在管理后台的"课程管理"页面可以找到这个ID
#define CourseId "690af61251fc83dcf5a7d37d"

; Unity Build输出路径（修改为你的实际路径）
#define UnityBuildPath "E:\Unity_StarterTest\MyCourse"

; 安装程序输出路径
#define OutputPath "D:\Installers"

; 应用图标（可选，如果没有可以注释掉）
; #define AppIconPath "D:\UnityBuilds\MyCourse\icon.ico"

; 唯一的AppId（使用 https://www.guidgenerator.com/ 生成）
#define AppId "{{A1B2C3D4-1234-5678-9ABC-DEF012345678}"

; ==========================================

[Setup]
; 应用标识
AppId={#AppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}

; 安装路径
DefaultDirName={autopf}\YF Courses\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; 输出设置
OutputDir={#OutputPath}
OutputBaseFilename={#MyAppName}-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes

; UI设置
WizardStyle=modern
#ifdef AppIconPath
SetupIconFile={#AppIconPath}
UninstallDisplayIcon={app}\{#MyAppExeName}
#endif

; 权限（需要管理员权限以写入HKLM注册表）
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; 版本信息
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} 安装程序
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
; 如需中文界面，请先下载中文语言包
; Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Unity Build的所有文件
Source: "{#UnityBuildPath}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; 开始菜单快捷方式
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; 桌面快捷方式（可选）
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; 🔑 关键：写入注册表让YF启动器自动检测
; CourseId必须与数据库中的课程ID完全一致！
Root: HKLM; Subkey: "SOFTWARE\YFCourses\{#CourseId}"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}\{#MyAppExeName}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\YFCourses\{#CourseId}"; ValueType: string; ValueName: "CourseName"; ValueData: "{#MyAppName}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\YFCourses\{#CourseId}"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "SOFTWARE\YFCourses\{#CourseId}"; ValueType: string; ValueName: "Publisher"; ValueData: "{#MyAppPublisher}"; Flags: uninsdeletekey

[Run]
; 安装完成后询问是否运行
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; 卸载时删除运行时生成的文件
Type: filesandordirs; Name: "{app}\*"

[Code]
// 初始化安装前检查
function InitializeSetup(): Boolean;
var
  OldPath: String;
  OldVersion: String;
  ResultCode: Integer;
begin
  Result := True;
  
  // 检查是否已安装
  if RegQueryStringValue(HKLM, 'SOFTWARE\YFCourses\{#CourseId}', 'InstallPath', OldPath) then
  begin
    RegQueryStringValue(HKLM, 'SOFTWARE\YFCourses\{#CourseId}', 'Version', OldVersion);
    
    if MsgBox('检测到已安装版本 ' + OldVersion + #13#10 + 
              '是否继续安装 {#MyAppVersion}（会覆盖旧版本）？', 
              mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;
end;

// 初始化卸载前提示
function InitializeUninstall(): Boolean;
begin
  Result := True;
  
  if MsgBox('确定要卸载 {#MyAppName} 吗？' + #13#10 + 
            '卸载后需要重新激活才能使用。', 
            mbConfirmation, MB_YESNO) = IDNO then
    Result := False;
end;

// 卸载完成
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    MsgBox('{#MyAppName} 已成功卸载。', mbInformation, MB_OK);
  end;
end;

