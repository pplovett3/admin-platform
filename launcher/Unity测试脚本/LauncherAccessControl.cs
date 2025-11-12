using UnityEngine;
using System;
using System.Collections;

/// <summary>
/// 启动器访问控制 - 强制必须通过启动器启动
/// 提供3种强度的控制策略
/// </summary>
public class LauncherAccessControl : MonoBehaviour
{
    [Header("Editor测试设置")]
    [Tooltip("在Editor中启用访问控制测试")]
    public bool testInEditor = false;
    
    [Header("访问控制策略")]
    [Tooltip("选择访问控制的严格程度")]
    public AccessControlMode controlMode = AccessControlMode.Warning;
    
    [Header("提示设置")]
    [Tooltip("等待Token的超时时间（秒）")]
    public float tokenTimeout = 3f;
    
    [Tooltip("强制退出前的倒计时（秒）")]
    public float exitCountdown = 5f;
    
    [Header("UI引用（可选）")]
    public GameObject warningPanel;
    public UnityEngine.UI.Text warningText;
    
    private bool isCheckingToken = false;
    
    public enum AccessControlMode
    {
        /// <summary>
        /// 仅警告：显示警告但允许继续使用
        /// 适用场景：开发测试、演示环境
        /// </summary>
        Warning,
        
        /// <summary>
        /// 功能限制：允许打开但禁用关键功能
        /// 适用场景：需要演示基础功能但限制核心操作
        /// </summary>
        Limited,
        
        /// <summary>
        /// 强制退出：检测到未授权启动立即退出
        /// 适用场景：正式部署、严格权限控制
        /// </summary>
        ForceExit
    }
    
    void Start()
    {
#if UNITY_EDITOR
        if (!testInEditor)
        {
            // Editor模式下默认跳过检查
            Debug.Log("🔧 Editor模式：跳过启动器访问控制（勾选testInEditor可测试）");
            return;
        }
        Debug.Log("🧪 Editor测试模式：启用访问控制测试");
#endif
        
        StartCoroutine(CheckLauncherAccess());
    }
    
    IEnumerator CheckLauncherAccess()
    {
        isCheckingToken = true;
        
        // 等待TokenReceiver初始化
        float elapsedTime = 0f;
        while (elapsedTime < tokenTimeout)
        {
            if (TokenReceiver.Instance != null && TokenReceiver.Instance.tokenReceived)
            {
                // Token接收成功
                Debug.Log("✅ 访问验证通过：通过启动器启动");
                isCheckingToken = false;
                yield break;
            }
            
            yield return new WaitForSeconds(0.1f);
            elapsedTime += 0.1f;
        }
        
        // 超时，未检测到Token
        Debug.LogWarning("⚠️ 访问验证失败：未检测到启动器Token");
        isCheckingToken = false;
        
        // 根据策略执行对应操作
        switch (controlMode)
        {
            case AccessControlMode.Warning:
                HandleWarningMode();
                break;
                
            case AccessControlMode.Limited:
                HandleLimitedMode();
                break;
                
            case AccessControlMode.ForceExit:
                HandleForceExitMode();
                break;
        }
    }
    
    /// <summary>
    /// 策略1：警告模式 - 仅显示警告提示
    /// </summary>
    void HandleWarningMode()
    {
        Debug.LogWarning("📢 警告模式：应用应通过YF课程启动器启动");
        Debug.LogWarning("   部分功能可能无法正常使用");
        
        ShowWarningUI(
            "⚠️ 未授权访问警告",
            "检测到您直接打开了本应用。\n\n" +
            "本应用应通过 YF课程启动器 启动。\n" +
            "直接打开可能导致部分功能无法使用。\n\n" +
            "请关闭本窗口并通过启动器启动。",
            false
        );
    }
    
    /// <summary>
    /// 策略2：限制模式 - 禁用关键功能
    /// </summary>
    void HandleLimitedMode()
    {
        Debug.LogWarning("🔒 限制模式：关键功能已禁用");
        
        // 设置全局标志
        GameManager.Instance?.SetLimitedMode(true);
        
        ShowWarningUI(
            "🔒 功能受限模式",
            "检测到您直接打开了本应用。\n\n" +
            "应用已进入功能受限模式。\n" +
            "核心功能需要通过 YF课程启动器 启动才能使用。\n\n" +
            "您可以浏览基础内容，但无法进行以下操作：\n" +
            "• 保存学习进度\n" +
            "• 提交作业或成绩\n" +
            "• 访问个性化内容\n\n" +
            "请通过启动器启动以解锁全部功能。",
            false
        );
    }
    
    /// <summary>
    /// 策略3：强制退出模式 - 立即退出应用
    /// </summary>
    void HandleForceExitMode()
    {
        Debug.LogError("🚫 强制退出模式：未授权访问，应用将关闭");
        
        StartCoroutine(ExitWithCountdown());
    }
    
    IEnumerator ExitWithCountdown()
    {
        float remainingTime = exitCountdown;
        
        while (remainingTime > 0)
        {
            ShowWarningUI(
                "🚫 未授权访问",
                $"本应用必须通过 YF课程启动器 启动！\n\n" +
                $"检测到未授权访问，应用将在 {Mathf.Ceil(remainingTime)} 秒后自动关闭。\n\n" +
                $"请关闭本窗口，打开 YF课程启动器：\n" +
                $"1. 登录学生账号\n" +
                $"2. 激活课程\n" +
                $"3. 点击\"启动课程\"按钮\n\n" +
                $"如有疑问，请联系管理员。",
                true
            );
            
            yield return new WaitForSeconds(1f);
            remainingTime -= 1f;
        }
        
        Debug.LogError("应用因未授权访问而退出");
        
        // 退出应用
#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#else
        Application.Quit();
#endif
    }
    
    /// <summary>
    /// 显示警告UI
    /// </summary>
    void ShowWarningUI(string title, string message, bool isCountdown)
    {
        if (warningPanel != null)
        {
            warningPanel.SetActive(true);
            
            if (warningText != null)
            {
                warningText.text = $"{title}\n\n{message}";
            }
        }
        else
        {
            // 如果没有UI，在Console显示
            Debug.LogWarning($"{title}\n{message}");
        }
    }
    
    /// <summary>
    /// 检查是否为授权访问
    /// </summary>
    public static bool IsAuthorizedAccess()
    {
#if UNITY_EDITOR
        return true;  // Editor模式始终授权
#endif
        
        if (TokenReceiver.Instance == null)
            return false;
            
        return TokenReceiver.Instance.tokenReceived;
    }
}

/// <summary>
/// 游戏管理器示例 - 处理受限模式
/// </summary>
public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }
    
    private bool isLimitedMode = false;
    
    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }
        else
        {
            Destroy(gameObject);
        }
    }
    
    public void SetLimitedMode(bool limited)
    {
        isLimitedMode = limited;
        Debug.Log($"游戏模式: {(limited ? "受限模式" : "完整模式")}");
    }
    
    public bool IsLimitedMode()
    {
        return isLimitedMode;
    }
    
    // 示例：检查是否可以保存进度
    public bool CanSaveProgress()
    {
        if (isLimitedMode)
        {
            Debug.LogWarning("受限模式：无法保存进度");
            return false;
        }
        return LauncherAccessControl.IsAuthorizedAccess();
    }
    
    // 示例：检查是否可以提交成绩
    public bool CanSubmitScore()
    {
        if (isLimitedMode)
        {
            Debug.LogWarning("受限模式：无法提交成绩");
            return false;
        }
        return LauncherAccessControl.IsAuthorizedAccess();
    }
}

