using UnityEngine;
using System;
using System.Text;
using System.Collections.Generic;

/// <summary>
/// Token接收器 - 从启动器接收JWT Token并解析用户信息
/// 使用方法：挂载到场景中的任意GameObject上（建议创建一个GameManager）
/// </summary>
public class TokenReceiver : MonoBehaviour
{
    [Header("调试设置")]
    [Tooltip("在Editor中测试用的假Token")]
    public bool useTestTokenInEditor = true;
    
    [Header("用户信息（运行时自动填充）")]
    public string userId;
    public string userName;
    public string userRole;
    public string userPhone;
    public string userSchool;
    public string userClass;
    
    [Header("Token信息")]
    public string jwtToken;
    public bool tokenReceived = false;
    
    // 单例
    public static TokenReceiver Instance { get; private set; }
    
    void Awake()
    {
        // 单例模式
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }
    
    void Start()
    {
        Debug.Log("=== YF课程启动器 Token接收器 ===");
        
#if UNITY_EDITOR
        // 编辑器中测试
        if (useTestTokenInEditor)
        {
            Debug.Log("⚙️ Editor模式：使用测试Token");
            SimulateToken();
            return;
        }
#endif
        
        // 获取命令行参数
        string[] args = Environment.GetCommandLineArgs();
        
        Debug.Log($"📋 命令行参数数量: {args.Length}");
        for (int i = 0; i < args.Length; i++)
        {
            Debug.Log($"  参数[{i}]: {args[i]}");
        }
        
        // 查找 --token 参数
        bool found = false;
        foreach (string arg in args)
        {
            if (arg.StartsWith("--token="))
            {
                jwtToken = arg.Substring(8);
                found = true;
                Debug.Log("✅ 成功接收到Token!");
                Debug.Log($"Token长度: {jwtToken.Length}");
                Debug.Log($"Token前20字符: {jwtToken.Substring(0, Math.Min(20, jwtToken.Length))}...");
                
                // 解析JWT
                ParseJWT(jwtToken);
                break;
            }
        }
        
        if (!found)
        {
            Debug.LogWarning("⚠️ 未找到Token参数！");
            Debug.LogWarning("请通过YF课程启动器启动本应用。");
            Debug.LogWarning("或在Editor中启用useTestTokenInEditor进行测试。");
        }
    }
    
    /// <summary>
    /// 解析JWT Token
    /// </summary>
    void ParseJWT(string token)
    {
        try
        {
            // JWT格式: header.payload.signature
            string[] parts = token.Split('.');
            
            if (parts.Length != 3)
            {
                Debug.LogError("❌ Token格式错误：不是有效的JWT格式");
                return;
            }
            
            // 解码payload部分（Base64 URL编码）
            string payload = parts[1];
            
            // 修正Base64填充
            int mod = payload.Length % 4;
            if (mod > 0)
            {
                payload += new string('=', 4 - mod);
            }
            
            // 替换URL安全字符为标准Base64字符
            payload = payload.Replace('-', '+').Replace('_', '/');
            
            // Base64解码
            byte[] jsonBytes = Convert.FromBase64String(payload);
            string json = Encoding.UTF8.GetString(jsonBytes);
            
            Debug.Log("📦 JWT Payload (JSON): " + json);
            
            // 解析JSON
            UserInfo userInfo = JsonUtility.FromJson<UserInfo>(json);
            
            if (userInfo != null)
            {
                // 保存用户信息
                userId = userInfo.userId;
                userName = userInfo.name;
                userRole = userInfo.role;
                userPhone = userInfo.phone;
                userSchool = userInfo.school ?? "未设置";
                userClass = userInfo.className ?? "未设置";
                
                tokenReceived = true;
                
                // 打印用户信息
                Debug.Log("=== 用户信息 ===");
                Debug.Log($"✓ 用户ID: {userId}");
                Debug.Log($"✓ 姓名: {userName}");
                Debug.Log($"✓ 角色: {userRole}");
                Debug.Log($"✓ 手机: {userPhone}");
                Debug.Log($"✓ 学校: {userSchool}");
                Debug.Log($"✓ 班级: {userClass}");
                Debug.Log("================");
                
                // 检查Token是否过期
                CheckTokenExpiration(userInfo);
            }
            else
            {
                Debug.LogError("❌ JSON解析失败");
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ JWT解析失败: {e.Message}");
            Debug.LogError($"堆栈: {e.StackTrace}");
        }
    }
    
    /// <summary>
    /// 检查Token是否过期
    /// </summary>
    void CheckTokenExpiration(UserInfo userInfo)
    {
        if (userInfo.exp > 0)
        {
            // Unix时间戳转DateTime
            DateTime expireTime = DateTimeOffset.FromUnixTimeSeconds(userInfo.exp).LocalDateTime;
            DateTime now = DateTime.Now;
            
            if (now > expireTime)
            {
                Debug.LogWarning($"⚠️ Token已过期！过期时间: {expireTime}");
            }
            else
            {
                TimeSpan remaining = expireTime - now;
                Debug.Log($"✓ Token有效，剩余时间: {remaining.Hours}小时 {remaining.Minutes}分钟");
            }
        }
    }
    
    /// <summary>
    /// Editor中模拟Token（测试用）
    /// </summary>
    void SimulateToken()
    {
        // 模拟用户信息
        userId = "test-user-id-12345";
        userName = "测试学生001";
        userRole = "student";
        userPhone = "13800005304";
        userSchool = "测试学校";
        userClass = "测试班级";
        
        tokenReceived = true;
        
        Debug.Log("=== 模拟用户信息（测试模式）===");
        Debug.Log($"✓ 用户ID: {userId}");
        Debug.Log($"✓ 姓名: {userName}");
        Debug.Log($"✓ 角色: {userRole}");
        Debug.Log($"✓ 手机: {userPhone}");
        Debug.Log($"✓ 学校: {userSchool}");
        Debug.Log($"✓ 班级: {userClass}");
        Debug.Log("=================================");
    }
    
    /// <summary>
    /// 获取用户信息（供其他脚本调用）
    /// </summary>
    public UserInfo GetUserInfo()
    {
        if (!tokenReceived)
        {
            Debug.LogWarning("Token尚未接收或解析失败");
            return null;
        }
        
        return new UserInfo
        {
            userId = this.userId,
            name = this.userName,
            role = this.userRole,
            phone = this.userPhone,
            school = this.userSchool,
            className = this.userClass
        };
    }
}

/// <summary>
/// 用户信息结构（匹配JWT Payload）
/// </summary>
[Serializable]
public class UserInfo
{
    public string userId;
    public string name;
    public string role;      // superadmin / schoolAdmin / teacher / student
    public string phone;
    public string school;
    public string schoolId;
    public string className;
    
    // JWT标准字段
    public long iat;  // issued at (Unix时间戳)
    public long exp;  // expiration (Unix时间戳)
}

