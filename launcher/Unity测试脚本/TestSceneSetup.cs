using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;

/// <summary>
/// 测试场景自动设置
/// 使用方法：挂载到空GameObject上，会自动创建测试UI
/// </summary>
public class TestSceneSetup : MonoBehaviour
{
    private static Text logText;
    private static List<string> logMessages = new List<string>();
    private const int maxLogLines = 15;
    
    void Start()
    {
        CreateTestUI();
        
        // 注册Unity日志回调
        Application.logMessageReceived += HandleLog;
    }
    
    void OnDestroy()
    {
        Application.logMessageReceived -= HandleLog;
    }
    
    void HandleLog(string logString, string stackTrace, LogType type)
    {
        // 根据日志类型添加图标
        string icon = "";
        string color = "white";
        
        switch (type)
        {
            case LogType.Error:
            case LogType.Exception:
                icon = "❌";
                color = "#ff6b6b";
                break;
            case LogType.Warning:
                icon = "⚠️";
                color = "#ffd93d";
                break;
            case LogType.Log:
                icon = "✓";
                color = "#6bcf7f";
                break;
        }
        
        // 添加日志消息
        string message = $"<color={color}>{icon} {logString}</color>";
        logMessages.Add(message);
        
        // 保持最大行数
        if (logMessages.Count > maxLogLines)
        {
            logMessages.RemoveAt(0);
        }
        
        // 更新UI
        if (logText != null)
        {
            logText.text = string.Join("\n", logMessages);
        }
    }
    
    public static void AddCustomLog(string message, string color = "white")
    {
        logMessages.Add($"<color={color}>{message}</color>");
        if (logMessages.Count > maxLogLines)
        {
            logMessages.RemoveAt(0);
        }
        if (logText != null)
        {
            logText.text = string.Join("\n", logMessages);
        }
    }
    
    void CreateTestUI()
    {
        // 创建Canvas
        GameObject canvasObj = new GameObject("Canvas");
        Canvas canvas = canvasObj.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvasObj.AddComponent<CanvasScaler>();
        canvasObj.AddComponent<GraphicRaycaster>();
        
        // 创建左侧用户信息Panel
        GameObject leftPanelObj = new GameObject("UserInfoPanel");
        leftPanelObj.transform.SetParent(canvasObj.transform, false);
        
        Image leftPanelImage = leftPanelObj.AddComponent<Image>();
        leftPanelImage.color = new Color(0.1f, 0.1f, 0.15f, 0.95f);
        
        RectTransform leftPanelRect = leftPanelObj.GetComponent<RectTransform>();
        leftPanelRect.anchorMin = new Vector2(0, 0.5f);
        leftPanelRect.anchorMax = new Vector2(0, 0.5f);
        leftPanelRect.pivot = new Vector2(0, 0.5f);
        leftPanelRect.anchoredPosition = new Vector2(20, 0);
        leftPanelRect.sizeDelta = new Vector2(450, 400);
        
        // 创建用户信息文本
        CreateTextUI(leftPanelObj, "Title", new Vector2(0, 170), 22, "YF课程启动器", TextAnchor.UpperCenter);
        GameObject statusObj = CreateTextUI(leftPanelObj, "Status", new Vector2(0, 130), 16, "⏳ 正在接收Token...", TextAnchor.MiddleCenter);
        CreateTextUI(leftPanelObj, "UserId", new Vector2(0, 80), 14, "用户ID: -", TextAnchor.MiddleLeft);
        CreateTextUI(leftPanelObj, "UserName", new Vector2(0, 50), 14, "姓名: -", TextAnchor.MiddleLeft);
        CreateTextUI(leftPanelObj, "UserRole", new Vector2(0, 20), 14, "角色: -", TextAnchor.MiddleLeft);
        CreateTextUI(leftPanelObj, "UserPhone", new Vector2(0, -10), 14, "手机: -", TextAnchor.MiddleLeft);
        CreateTextUI(leftPanelObj, "UserSchool", new Vector2(0, -40), 14, "学校: -", TextAnchor.MiddleLeft);
        CreateTextUI(leftPanelObj, "UserClass", new Vector2(0, -70), 14, "班级: -", TextAnchor.MiddleLeft);
        
        // 创建右侧日志Panel
        GameObject rightPanelObj = new GameObject("LogPanel");
        rightPanelObj.transform.SetParent(canvasObj.transform, false);
        
        Image rightPanelImage = rightPanelObj.AddComponent<Image>();
        rightPanelImage.color = new Color(0.05f, 0.05f, 0.1f, 0.95f);
        
        RectTransform rightPanelRect = rightPanelObj.GetComponent<RectTransform>();
        rightPanelRect.anchorMin = new Vector2(1, 0.5f);
        rightPanelRect.anchorMax = new Vector2(1, 0.5f);
        rightPanelRect.pivot = new Vector2(1, 0.5f);
        rightPanelRect.anchoredPosition = new Vector2(-20, 0);
        rightPanelRect.sizeDelta = new Vector2(550, 500);
        
        // 日志标题
        CreateTextUI(rightPanelObj, "LogTitle", new Vector2(0, 230), 20, "📋 系统日志", TextAnchor.UpperCenter);
        
        // 日志内容区域（滚动文本）
        GameObject logTextObj = CreateTextUI(rightPanelObj, "LogText", new Vector2(0, 0), 13, "等待日志输出...", TextAnchor.UpperLeft);
        logText = logTextObj.GetComponent<Text>();
        
        RectTransform logTextRect = logTextObj.GetComponent<RectTransform>();
        logTextRect.sizeDelta = new Vector2(520, 420);
        logTextRect.anchoredPosition = new Vector2(0, -30);
        
        // 支持富文本
        logText.supportRichText = true;
        logText.color = new Color(0.9f, 0.9f, 0.9f, 1f);
        
        // 添加UserInfoUI组件
        UserInfoUI uiScript = canvasObj.AddComponent<UserInfoUI>();
        uiScript.titleText = GameObject.Find("Title").GetComponent<Text>();
        uiScript.statusText = statusObj.GetComponent<Text>();
        uiScript.userIdText = GameObject.Find("UserId").GetComponent<Text>();
        uiScript.userNameText = GameObject.Find("UserName").GetComponent<Text>();
        uiScript.userRoleText = GameObject.Find("UserRole").GetComponent<Text>();
        uiScript.userPhoneText = GameObject.Find("UserPhone").GetComponent<Text>();
        uiScript.userSchoolText = GameObject.Find("UserSchool").GetComponent<Text>();
        uiScript.userClassText = GameObject.Find("UserClass").GetComponent<Text>();
        
        Debug.Log("测试UI创建完成");
    }
    
    GameObject CreateTextUI(GameObject parent, string name, Vector2 position, int fontSize, string text, TextAnchor alignment = TextAnchor.MiddleLeft)
    {
        GameObject textObj = new GameObject(name);
        textObj.transform.SetParent(parent.transform, false);
        
        Text textComponent = textObj.AddComponent<Text>();
        textComponent.text = text;
        textComponent.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        textComponent.fontSize = fontSize;
        textComponent.color = Color.white;
        textComponent.alignment = alignment;
        
        RectTransform textRect = textObj.GetComponent<RectTransform>();
        textRect.anchorMin = new Vector2(0.5f, 0.5f);
        textRect.anchorMax = new Vector2(0.5f, 0.5f);
        textRect.pivot = new Vector2(0.5f, 0.5f);
        textRect.anchoredPosition = position;
        
        // 根据对齐方式调整大小
        if (alignment == TextAnchor.UpperLeft || alignment == TextAnchor.MiddleLeft)
        {
            textRect.sizeDelta = new Vector2(420, 30);
            textRect.pivot = new Vector2(0, 0.5f);
            textRect.anchoredPosition = new Vector2(-200, position.y);
        }
        else
        {
            textRect.sizeDelta = new Vector2(420, 30);
        }
        
        return textObj;
    }
}

