using System;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json;

/// <summary>
/// Unity中解析课件JSON数据中的显隐动画示例
/// </summary>
public class CoursewareAnimationPlayer : MonoBehaviour
{
    [System.Serializable]
    public class VisibilityKeyframe
    {
        public float time;
        public bool visible;
        public DebugInfo _debug;
        
        [System.Serializable]
        public class DebugInfo
        {
            public string uuid;
            public string objectName;
        }
    }
    
    [System.Serializable]
    public class TransformKeyframe
    {
        public float time;
        public float[] position;
        public float[] rotationEuler;
        public float[] scale;
        public string easing = "linear";
    }
    
    [System.Serializable]
    public class AnimationTimeline
    {
        public float duration;
        public Dictionary<string, VisibilityKeyframe[]> visibilityTracks;
        public Dictionary<string, TransformKeyframe[]> transformTracks;
        // 相机轨道等其他数据...
    }
    
    [System.Serializable]
    public class CoursewareAnimation
    {
        public string id;
        public string name;
        public string description;
        public bool isOriginal;
        public float duration;
        public AnimationTimeline timeline;
        // 步骤数据等...
    }
    
    [System.Serializable]
    public class CoursewareData
    {
        public CoursewareAnimation[] animations;
        // 其他课件数据...
    }
    
    // 当前播放状态
    private CoursewareAnimation currentAnimation;
    private float currentTime = 0f;
    private bool isPlaying = false;
    
    // 对象映射缓存
    private Dictionary<string, GameObject> objectPathToGameObject = new Dictionary<string, GameObject>();
    
    /// <summary>
    /// 加载课件JSON数据
    /// </summary>
    public void LoadCoursewareData(string jsonData)
    {
        try
        {
            CoursewareData courseware = JsonConvert.DeserializeObject<CoursewareData>(jsonData);
            
            Debug.Log($"加载课件数据，包含 {courseware.animations.Length} 个动画");
            
            foreach (var anim in courseware.animations)
            {
                Debug.Log($"动画: {anim.name}");
                Debug.Log($"  显隐轨道数量: {anim.timeline.visibilityTracks?.Count ?? 0}");
                Debug.Log($"  变换轨道数量: {anim.timeline.transformTracks?.Count ?? 0}");
                
                // 显示显隐轨道详情
                if (anim.timeline.visibilityTracks != null)
                {
                    foreach (var track in anim.timeline.visibilityTracks)
                    {
                        Debug.Log($"    显隐轨道 {track.Key}: {track.Value.Length}个关键帧");
                    }
                }
            }
            
            // 播放第一个动画
            if (courseware.animations.Length > 0)
            {
                PlayAnimation(courseware.animations[0]);
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"解析课件数据失败: {e.Message}");
        }
    }
    
    /// <summary>
    /// 播放指定动画
    /// </summary>
    public void PlayAnimation(CoursewareAnimation animation)
    {
        currentAnimation = animation;
        currentTime = 0f;
        isPlaying = true;
        
        Debug.Log($"开始播放动画: {animation.name} (时长: {animation.duration}s)");
        
        // 构建对象路径映射
        BuildObjectPathMapping();
    }
    
    /// <summary>
    /// 构建对象路径到GameObject的映射
    /// </summary>
    private void BuildObjectPathMapping()
    {
        objectPathToGameObject.Clear();
        
        // 遍历场景中的所有对象，建立路径映射
        GameObject[] allObjects = FindObjectsOfType<GameObject>();
        
        foreach (GameObject obj in allObjects)
        {
            string path = GetObjectPath(obj);
            if (!string.IsNullOrEmpty(path))
            {
                objectPathToGameObject[path] = obj;
                Debug.Log($"映射对象路径: {path} → {obj.name}");
            }
        }
    }
    
    /// <summary>
    /// 获取对象的层级路径（与前端buildNamePath对应）
    /// </summary>
    private string GetObjectPath(GameObject obj)
    {
        List<string> pathSegments = new List<string>();
        Transform current = obj.transform;
        
        while (current != null)
        {
            if (!string.IsNullOrEmpty(current.name))
            {
                pathSegments.Insert(0, current.name);
            }
            current = current.parent;
        }
        
        return string.Join("/", pathSegments);
    }
    
    /// <summary>
    /// 更新动画播放
    /// </summary>
    void Update()
    {
        if (!isPlaying || currentAnimation == null)
            return;
            
        currentTime += Time.deltaTime;
        
        // 应用显隐动画
        ApplyVisibilityAnimation(currentTime);
        
        // 应用变换动画
        ApplyTransformAnimation(currentTime);
        
        // 检查是否播放完成
        if (currentTime >= currentAnimation.duration)
        {
            isPlaying = false;
            Debug.Log($"动画播放完成: {currentAnimation.name}");
        }
    }
    
    /// <summary>
    /// 应用显隐动画
    /// </summary>
    private void ApplyVisibilityAnimation(float time)
    {
        if (currentAnimation.timeline.visibilityTracks == null)
            return;
            
        foreach (var track in currentAnimation.timeline.visibilityTracks)
        {
            string objectPath = track.Key;
            VisibilityKeyframe[] keyframes = track.Value;
            
            if (!objectPathToGameObject.ContainsKey(objectPath))
            {
                Debug.LogWarning($"未找到对象: {objectPath}");
                continue;
            }
            
            GameObject targetObject = objectPathToGameObject[objectPath];
            
            // 查找当前时间对应的可见性状态
            bool shouldBeVisible = GetVisibilityAtTime(keyframes, time);
            
            // 应用可见性
            if (targetObject.activeSelf != shouldBeVisible)
            {
                targetObject.SetActive(shouldBeVisible);
                Debug.Log($"设置 {objectPath} 可见性: {shouldBeVisible} (时间: {time:F2}s)");
            }
        }
    }
    
    /// <summary>
    /// 获取指定时间的可见性状态
    /// </summary>
    private bool GetVisibilityAtTime(VisibilityKeyframe[] keyframes, float time)
    {
        if (keyframes.Length == 0)
            return true;
            
        // 如果时间在第一个关键帧之前
        if (time <= keyframes[0].time)
            return keyframes[0].visible;
            
        // 如果时间在最后一个关键帧之后
        if (time >= keyframes[keyframes.Length - 1].time)
            return keyframes[keyframes.Length - 1].visible;
            
        // 在两个关键帧之间，找到对应的区间
        for (int i = 0; i < keyframes.Length - 1; i++)
        {
            if (time >= keyframes[i].time && time < keyframes[i + 1].time)
            {
                // 显隐动画通常是阶跃的，不需要插值
                return keyframes[i].visible;
            }
        }
        
        return keyframes[keyframes.Length - 1].visible;
    }
    
    /// <summary>
    /// 应用变换动画
    /// </summary>
    private void ApplyTransformAnimation(float time)
    {
        if (currentAnimation.timeline.transformTracks == null)
            return;
            
        foreach (var track in currentAnimation.timeline.transformTracks)
        {
            string objectPath = track.Key;
            TransformKeyframe[] keyframes = track.Value;
            
            if (!objectPathToGameObject.ContainsKey(objectPath))
                continue;
                
            GameObject targetObject = objectPathToGameObject[objectPath];
            
            // 应用变换动画（位置、旋转、缩放）
            ApplyTransformAtTime(targetObject.transform, keyframes, time);
        }
    }
    
    /// <summary>
    /// 应用指定时间的变换状态
    /// </summary>
    private void ApplyTransformAtTime(Transform target, TransformKeyframe[] keyframes, float time)
    {
        // 这里可以实现位置、旋转、缩放的插值逻辑
        // 具体实现根据需求而定
        
        foreach (var keyframe in keyframes)
        {
            if (Mathf.Abs(keyframe.time - time) < 0.1f) // 简单的时间匹配
            {
                if (keyframe.position != null && keyframe.position.Length == 3)
                {
                    target.localPosition = new Vector3(
                        keyframe.position[0],
                        keyframe.position[1], 
                        keyframe.position[2]
                    );
                }
                
                if (keyframe.rotationEuler != null && keyframe.rotationEuler.Length == 3)
                {
                    target.localRotation = Quaternion.Euler(
                        keyframe.rotationEuler[0] * Mathf.Rad2Deg,
                        keyframe.rotationEuler[1] * Mathf.Rad2Deg,
                        keyframe.rotationEuler[2] * Mathf.Rad2Deg
                    );
                }
                
                if (keyframe.scale != null && keyframe.scale.Length == 3)
                {
                    target.localScale = new Vector3(
                        keyframe.scale[0],
                        keyframe.scale[1],
                        keyframe.scale[2]
                    );
                }
                break;
            }
        }
    }
    
    /// <summary>
    /// 暂停/恢复播放
    /// </summary>
    public void TogglePlayback()
    {
        isPlaying = !isPlaying;
        Debug.Log($"动画播放状态: {(isPlaying ? "播放" : "暂停")}");
    }
    
    /// <summary>
    /// 跳转到指定时间
    /// </summary>
    public void SeekToTime(float time)
    {
        if (currentAnimation != null)
        {
            currentTime = Mathf.Clamp(time, 0f, currentAnimation.duration);
            ApplyVisibilityAnimation(currentTime);
            ApplyTransformAnimation(currentTime);
        }
    }
}

/* 使用示例:
 * 
 * 1. 将此脚本挂载到场景中的GameObject上
 * 2. 加载课件JSON数据:
 *    string jsonData = File.ReadAllText("courseware.json");
 *    GetComponent<CoursewareAnimationPlayer>().LoadCoursewareData(jsonData);
 * 
 * 3. JSON数据格式示例:
 * {
 *   "animations": [
 *     {
 *       "id": "anim-1",
 *       "name": "显隐测试动画",
 *       "duration": 6.0,
 *       "timeline": {
 *         "visibilityTracks": {
 *           "Engine/Cylinder": [
 *             {"time": 0, "visible": true},
 *             {"time": 2, "visible": false},
 *             {"time": 4, "visible": true}
 *           ]
 *         }
 *       }
 *     }
 *   ]
 * }
 */
