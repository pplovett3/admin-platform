好的，这是为您整理好的Markdown格式需求文档。您可以直接复制并保存为 `.md` 文件，方便在开发团队中分享和使用。

---

# AI智能标注功能需求文档 (V1.0)

## 1. 项目目标

本功能旨在解决3D课件编辑器中原始模型结构树层级混乱、部件命名不规范的问题。通过集成**阿里通义千问**多模态大模型，实现对模型结构和部件名称的自动化整理与优化，从而极大提升课件标注的效率和专业性。

## 2. 核心业务流程

![AI标注功能流程图](https://storage.googleapis.com/gemini-prod/images/2290f671-5503-49d6-b9ef-60a6a4f912cd.png)

1.  **用户触发：** 用户在编辑器界面点击【AI智能整理】按钮。
2.  **前端数据准备：**
    *   将当前编辑器中的模型结构树，转换为一份包含节点唯一标识（如`path`或`id`）和原始名称的 **`JSON`** 文件。
    *   对整个模型进行一次 **全局截图**。
    *   遍历结构树中的关键部件（可设定一个层级深度或部件数量上限），通过“隔离显示”功能，为每个部件生成一张 **独立截图**。
3.  **数据发送：** 前端将准备好的`JSON`数据、1张全局截图、N张部件独立截图，打包发送至后端API。
4.  **后端处理与AI调用：**
    *   后端接收到数据。
    *   根据预设的Prompt模板，将`JSON`数据和所有图片信息整合，构造一个发送给 **通义千问多模态API（如qwen-vl-plus）** 的请求。
    *   调用API并等待返回结果。
5.  **结果解析与返回：**
    *   后端接收到通义千问返回的、经过整理和重命名的 **新`JSON`数据**。
    *   对返回的`JSON`进行格式校验，确保其符合预定规范后，再将其返回给前端。
6.  **前端界面更新：**
    *   前端收到新的`JSON`数据。
    *   弹出一个预览/确认窗口，用清晰的方式向用户展示“整理前”和“整理后”的结构树对比。
    *   用户点击【应用】后，编辑器将根据新`JSON`的数据，动态更新左侧的模型结构树，完成重命名和层级调整。

## 3. 数据格式要求

### 3.1 发送给后端的数据（前端准备）

需要一个包含结构化文本和多张图片的多部分请求（multipart request）。

*   **`structure_data` (JSON):** 原始的模型结构树。
    ```json
    {
      "tree": [
        {
          "path": "Group/Xiaomi_SU7_LRB/左后轮",
          "original_name": "左后轮",
          "children": [
            {
              "path": "Group/Xiaomi_SU7_LRB/左后轮/tire_001_LRW",
              "original_name": "tire_001_LRW"
            },
            {
              "path": "Group/Xiaomi_SU7_LRB/左后轮/brake_caliper_r_LRW",
              "original_name": "brake_caliper_r_LRW"
            }
            // ... more parts
          ]
        }
      ]
    }
    ```

*   **`global_image` (Image File):** 整体模型截图文件。

*   **`part_images` (Array of Image Files & Data):** 每个部件的独立截图及其元数据。建议打包成一个JSON数组，每个对象包含部件路径和对应的图片。
    ```json
    [
        {
            "path": "Group/Xiaomi_SU7_LRB/左后轮/tire_001_LRW",
            "image_file": "<tire_image_file_data>"
        },
        {
            "path": "Group/Xiaomi_SU7_LRB/左后轮/brake_caliper_r_LRW",
            "image_file": "<caliper_image_file_data>"
        }
    ]
    ```

### 3.2 期望从AI获得的数据（后端定义）

后端需要向通义千问明确要求，必须返回以下结构的JSON。

*   **`cleaned_structure` (JSON):** 整理后的模型结构树。
    ```json
    {
      "nodes": [
        {
          "original_path": "Group/Xiaomi_SU7_LRB/左后轮",
          "new_name": "左后轮总成",
          "children": [
            {
              "original_path": "Group/Xiaomi_SU7_LRB/左后轮/tire_001_LRW",
              "new_name": "轮胎",
              "children": []
            },
            {
                "new_name": "制动总成", // AI可能创建新的逻辑节点
                "children": [
                    {
                        "original_path": "Group/Xiaomi_SU7_LRB/左后轮/brake_caliper_r_LRW",
                        "new_name": "刹车卡钳",
                        "children": []
                    }
                    // ... 其他刹车部件
                ]
            }
          ]
        }
      ]
    }
    ```
    **关键字段说明：**
    *   `original_path`: **必须字段**。用于前端定位并修改原始的模型对象。
    *   `new_name`: AI生成的新名称。
    *   `children`: 新的子节点结构，用于重建层级。

## 4. 前端交互说明

1.  在“模型与结构树”面板上方，添加一个明确的按钮，如 **【AI智能整理】**。
2.  点击后，按钮变为不可用状态，并显示加载提示，如“AI正在整理模型，请稍候...”。
3.  接收到后端返回的数据后，弹出一个模态框（Modal）。
    *   模态框标题：“AI整理结果预览”。
    *   内容区清晰地展示新的结构树。
    *   底部包含两个按钮：**【应用更改】** 和 **【取消】**。
4.  用户点击【应用更改】，模态框关闭，左侧的模型结构树根据新数据刷新。
5.  用户点击【取消】，模态框关闭，模型结构树保持不变。

## 5. 技术实现要点

*   **后端：** 核心工作是构建一个高质量的 **Prompt**。该Prompt需要清晰地向通义千问传达任务目标、输入数据描述（JSON结构和图片含义）、以及严格的输出JSON格式要求。
*   **错误处理：** 需要处理API调用超时、返回格式错误、网络异常等情况，并向前端返回明确的错误信息。