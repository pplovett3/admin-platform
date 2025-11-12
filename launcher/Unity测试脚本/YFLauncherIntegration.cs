using UnityEngine;
using UnityEngine.UI;
using System;
using System.Collections;
using System.Text;

/// <summary>
/// YF课程启动器集成脚本 - 完整版
/// 功能：Token接收、用户认证、访问控制、UI显示
/// 使用方法：挂载到场景中的任意GameObject上
/// </summary>
public class YFLauncherIntegration : MonoBehaviour
{
    [Header("=== 调试设置 ===")]
    [Tooltip("在Editor中模拟Token测试")]
    public bool useTestTokenInEditor = true;
    
    [Tooltip("在Editor中测试访问控制")]
    public bool testAccessControlInEditor = false;
    
    [Header("=== 访问控制 ===")]
    [Tooltip("Token等待超时时间（秒）")]
    public float tokenTimeout = 3f;
    
    [Tooltip("未授权时的退出倒计时（秒）")]
    public float exitCountdown = 5f;
    
    [Header("=== UI设置 ===")]
    [Tooltip("成功欢迎信息显示时长（秒）")]
    public float welcomeDuration = 1.5f;
    
    [Tooltip("UI字体大小")]
    public int fontSize = 32;
    
    // 内部状态
    private bool tokenReceived = false;
    private string userId;
    private string userName;
    private string userRole;
    private GameObject messagePanel;
    private Text messageText;
    
    // 单例
    public static YFLauncherIntegration Instance { get; private set; }
    
    void Awake()
    {
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
        Debug.Log("=== YF课程启动器集成 v1.0 ===");
        
        // 创建UI
        CreateSimpleUI();
        
#if UNITY_EDITOR
        // Editor测试模式
        if (useTestTokenInEditor && !testAccessControlInEditor)
        {
            Debug.Log("🔧 Editor测试模式：使用模拟Token");
            SimulateToken();
            ShowWelcomeMessage();
            return;
        }
        
        if (!testAccessControlInEditor)
        {
            Debug.Log("🔧 Editor模式：跳过访问控制");
            return;
        }
        
        Debug.Log("🧪 Editor测试模式：测试访问控制");
#endif
        
        // 开始Token检查
        StartCoroutine(CheckTokenAndAuth());
    }
    
    /// <summary>
    /// 创建简单UI
    /// </summary>
    void CreateSimpleUI()
    {
        // Canvas
        GameObject canvasObj = new GameObject("YFCanvas");
        Canvas canvas = canvasObj.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 999; // 最上层
        canvasObj.AddComponent<CanvasScaler>();
        canvasObj.AddComponent<GraphicRaycaster>();
        DontDestroyOnLoad(canvasObj);
        
        // 消息面板（全屏半透明背景）
        messagePanel = new GameObject("MessagePanel");
        messagePanel.transform.SetParent(canvasObj.transform, false);
        
        Image panelImage = messagePanel.AddComponent<Image>();
        panelImage.color = new Color(0, 0, 0, 0.85f);
        
        RectTransform panelRect = messagePanel.GetComponent<RectTransform>();
        panelRect.anchorMin = Vector2.zero;
        panelRect.anchorMax = Vector2.one;
        panelRect.offsetMin = Vector2.zero;
        panelRect.offsetMax = Vector2.zero;
        
        // 消息文本（居中显示）
        GameObject textObj = new GameObject("MessageText");
        textObj.transform.SetParent(messagePanel.transform, false);
        
        messageText = textObj.AddComponent<Text>();
        messageText.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        messageText.fontSize = fontSize;
        messageText.color = Color.white;
        messageText.alignment = TextAnchor.MiddleCenter;
        messageText.supportRichText = true;
        
        RectTransform textRect = textObj.GetComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = new Vector2(50, 50);
        textRect.offsetMax = new Vector2(-50, -50);
        
        // 默认隐藏
        messagePanel.SetActive(false);
    }
    
    /// <summary>
    /// 检查Token和认证
    /// </summary>
    IEnumerator CheckTokenAndAuth()
    {
        Debug.Log("🔍 开始检查Token...");
        
        float elapsedTime = 0f;
        
        // 等待Token
        while (elapsedTime < tokenTimeout)
        {
            if (TryReceiveToken())
            {
                Debug.Log("✅ Token接收成功");
                tokenReceived = true;
                ShowWelcomeMessage();
                yield break;
            }
            
            yield return new WaitForSeconds(0.1f);
            elapsedTime += 0.1f;
        }
        
        // 超时未收到Token
        Debug.LogWarning("⚠️ 未检测到Token - 未授权访问");
        ShowUnauthorizedAndExit();
    }
    
    /// <summary>
    /// 尝试接收Token
    /// </summary>
    bool TryReceiveToken()
    {
        try
        {
            string[] args = Environment.GetCommandLineArgs();
            
            foreach (string arg in args)
            {
                if (arg.StartsWith("--token="))
                {
                    string token = arg.Substring(8);
                    Debug.Log($"📦 接收到Token (长度: {token.Length})");
                    
                    return ParseJWT(token);
                }
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ Token接收失败: {e.Message}");
        }
        
        return false;
    }
    
    /// <summary>
    /// 解析JWT Token
    /// </summary>
    bool ParseJWT(string token)
    {
        try
        {
            string[] parts = token.Split('.');
            if (parts.Length != 3)
            {
                Debug.LogError("❌ JWT格式错误");
                return false;
            }
            
            // 解码payload
            string payload = parts[1];
            int mod = payload.Length % 4;
            if (mod > 0) payload += new string('=', 4 - mod);
            payload = payload.Replace('-', '+').Replace('_', '/');
            
            byte[] jsonBytes = Convert.FromBase64String(payload);
            string json = Encoding.UTF8.GetString(jsonBytes);
            
            Debug.Log($"📄 JWT Payload: {json}");
            
            // 解析JSON
            UserInfo userInfo = JsonUtility.FromJson<UserInfo>(json);
            
            if (userInfo != null && !string.IsNullOrEmpty(userInfo.name))
            {
                userId = userInfo.userId;
                userName = userInfo.name;
                userRole = userInfo.role;
                
                Debug.Log($"✅ 用户信息解析成功");
                Debug.Log($"   姓名: {userName}");
                Debug.Log($"   角色: {GetRoleDisplay(userRole)}");
                
                return true;
            }
            
            return false;
        }
        catch (Exception e)
        {
            Debug.LogError($"❌ JWT解析失败: {e.Message}");
            return false;
        }
    }
    
    /// <summary>
    /// Editor模式模拟Token
    /// </summary>
    void SimulateToken()
    {
        userId = "test-user-123";
        userName = "测试学生001";
        userRole = "student";
        tokenReceived = true;
        
        Debug.Log("🎭 模拟用户信息:");
        Debug.Log($"   姓名: {userName}");
        Debug.Log($"   角色: 学生");
    }
    
    /// <summary>
    /// 显示欢迎消息（成功）
    /// </summary>
    void ShowWelcomeMessage()
    {
        StartCoroutine(ShowWelcomeCoroutine());
    }
    
    IEnumerator ShowWelcomeCoroutine()
    {
        if (messagePanel == null || messageText == null)
            yield break;
        
        // 显示欢迎消息
        messagePanel.SetActive(true);
        messageText.text = $"<size={fontSize + 10}>您好！</size>\n\n<size={fontSize}>{userName}</size>";
        messageText.color = new Color(0.4f, 1f, 0.4f); // 浅绿色
        
        Debug.Log($"👋 显示欢迎消息: {userName}");
        
        // 等待指定时间
        yield return new WaitForSeconds(welcomeDuration);
        
        // 淡出效果
        float fadeTime = 0.5f;
        float elapsed = 0f;
        
        Image panelImage = messagePanel.GetComponent<Image>();
        Color panelColor = panelImage.color;
        Color textColor = messageText.color;
        
        while (elapsed < fadeTime)
        {
            elapsed += Time.deltaTime;
            float alpha = 1f - (elapsed / fadeTime);
            
            panelImage.color = new Color(panelColor.r, panelColor.g, panelColor.b, panelColor.a * alpha);
            messageText.color = new Color(textColor.r, textColor.g, textColor.b, alpha);
            
            yield return null;
        }
        
        // 隐藏
        messagePanel.SetActive(false);
        Debug.Log("✅ 欢迎消息已关闭，进入应用");
    }
    
    /// <summary>
    /// 显示未授权并退出（失败）
    /// </summary>
    void ShowUnauthorizedAndExit()
    {
        StartCoroutine(UnauthorizedExitCoroutine());
    }
    
    IEnumerator UnauthorizedExitCoroutine()
    {
        if (messagePanel == null || messageText == null)
            yield break;
        
        messagePanel.SetActive(true);
        messageText.color = new Color(1f, 0.3f, 0.3f); // 红色
        
        float remaining = exitCountdown;
        
        while (remaining > 0)
        {
            messageText.text = 
                $"<size={fontSize}>⚠️ 请使用启动器启动本应用</size>\n\n" +
                $"<size={fontSize - 4}>应用即将关闭</size>\n\n" +
                $"<size={fontSize + 10}><b>{Mathf.Ceil(remaining)}</b></size>\n\n" +
                $"<size={fontSize - 8}>请打开 YF课程启动器\n登录后点击\"启动课程\"</size>";
            
            yield return new WaitForSeconds(1f);
            remaining -= 1f;
        }
        
        Debug.LogError("🚫 应用因未授权访问而退出");
        
        // 退出应用
#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#else
        Application.Quit();
#endif
    }
    
    /// <summary>
    /// 获取角色显示名称
    /// </summary>
    string GetRoleDisplay(string role)
    {
        switch (role)
        {
            case "superadmin": return "超级管理员";
            case "schoolAdmin": return "学校管理员";
            case "teacher": return "教师";
            case "student": return "学生";
            default: return role;
        }
    }
    
    /// <summary>
    /// 检查是否已授权
    /// </summary>
    public bool IsAuthorized()
    {
        return tokenReceived;
    }
    
    /// <summary>
    /// 获取用户信息
    /// </summary>
    public UserInfo GetUserInfo()
    {
        if (!tokenReceived) return null;
        
        return new UserInfo
        {
            userId = this.userId,
            name = this.userName,
            role = this.userRole
        };
    }
}

/// <summary>
/// 用户信息结构
/// </summary>
[Serializable]
public class UserInfo
{
    public string userId;
    public string name;
    public string role;
    public string phone;
    public string school;
    public string schoolId;
    public string className;
    public long iat;
    public long exp;
}

