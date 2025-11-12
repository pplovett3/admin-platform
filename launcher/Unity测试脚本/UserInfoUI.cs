using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// 用户信息UI显示
/// 使用方法：挂载到Canvas上，会自动显示Token接收器解析的用户信息
/// </summary>
public class UserInfoUI : MonoBehaviour
{
    [Header("UI引用")]
    public Text titleText;
    public Text userIdText;
    public Text userNameText;
    public Text userRoleText;
    public Text userPhoneText;
    public Text userSchoolText;
    public Text userClassText;
    public Text statusText;
    
    [Header("刷新设置")]
    public float updateInterval = 0.5f;  // 更新间隔（秒）
    
    private float nextUpdateTime = 0f;
    
    void Start()
    {
        // 初始化UI
        if (titleText != null)
            titleText.text = "YF课程启动器 - 用户信息";
            
        UpdateUI();
    }
    
    void Update()
    {
        // 定期更新UI
        if (Time.time >= nextUpdateTime)
        {
            UpdateUI();
            nextUpdateTime = Time.time + updateInterval;
        }
    }
    
    void UpdateUI()
    {
        // 检查TokenReceiver是否存在
        if (TokenReceiver.Instance == null)
        {
            SetStatusText("⏳ 等待Token接收器初始化...", Color.yellow);
            return;
        }
        
        // 检查是否已接收Token
        if (!TokenReceiver.Instance.tokenReceived)
        {
            SetStatusText("⏳ 等待接收Token...", Color.yellow);
            ClearUserInfo();
            return;
        }
        
        // 显示用户信息
        SetStatusText("✅ Token已接收并解析", Color.green);
        
        if (userIdText != null)
            userIdText.text = $"用户ID: {TokenReceiver.Instance.userId}";
            
        if (userNameText != null)
            userNameText.text = $"姓名: {TokenReceiver.Instance.userName}";
            
        if (userRoleText != null)
        {
            string roleDisplay = GetRoleDisplay(TokenReceiver.Instance.userRole);
            userRoleText.text = $"角色: {roleDisplay}";
        }
            
        if (userPhoneText != null)
            userPhoneText.text = $"手机: {TokenReceiver.Instance.userPhone}";
            
        if (userSchoolText != null)
            userSchoolText.text = $"学校: {TokenReceiver.Instance.userSchool}";
            
        if (userClassText != null)
            userClassText.text = $"班级: {TokenReceiver.Instance.userClass}";
    }
    
    void ClearUserInfo()
    {
        if (userIdText != null) userIdText.text = "用户ID: -";
        if (userNameText != null) userNameText.text = "姓名: -";
        if (userRoleText != null) userRoleText.text = "角色: -";
        if (userPhoneText != null) userPhoneText.text = "手机: -";
        if (userSchoolText != null) userSchoolText.text = "学校: -";
        if (userClassText != null) userClassText.text = "班级: -";
    }
    
    void SetStatusText(string text, Color color)
    {
        if (statusText != null)
        {
            statusText.text = text;
            statusText.color = color;
        }
    }
    
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
}

