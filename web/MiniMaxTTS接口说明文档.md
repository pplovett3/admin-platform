创建语音生成任务
POST
https://api.minimaxi.com/v1/t2a_async_v2
请求头
Authorization string required
HTTP：Bearer Auth

Security Scheme Type: http
HTTP Authorization Scheme: Bearer API_key，用于验证账户信息，可在 账户管理>接口密钥 中查看
Content-Type application/json required
请求体的媒介类型，请设置为 application/json，确保请求数据的格式为 JSON


请求体
model string required
调用的模型版本。目前支持： speech-2.5-hd-preview speech-2.5-turbo-preview speech-02-hd speech-02-turbo speech-01-hd speech-01-turbo

text string required
待合成音频的文本，限制最长 5 万字符。和 "text_file_id" 二选一必填

text_file_id int64 required
待合成音频的文本文件 id，单个文件长度限制小于 10 万字符，支持的文件格式：txt、zip。和 "text" 二选一必填，传入后自动校验格式。

txt 文件：长度限制 <100,000 字符。支持使用 <#x#> 标记自定义停顿。x 为停顿时长（单位：秒），范围 [0.01,99.99]，最多保留两位小数。注意停顿需设置在两个可以语音发音的文本之间，不可连续使用多个停顿标记
zip 文件：
压缩包内需包含同一格式的 txt 或 json 文件。
json 文件格式：支持 ["title", "content", "extra"] 三个字段，分别表示标题、正文、附加信息。若三个字段都存在，则产出 3 组结果，共 9 个文件，统一存放在一个文件夹中。若某字段不存在或内容为空，则该字段不会生成对应结果
voice_setting object required
voice_id string required
合成音频的音色编号。可查看音色列表或使用 查询可用音色接口 查询全部可用音色

中文：
moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85
Chinese (Mandarin)_Lyrical_Voice
moss_audio_aaa1346a-7ce7-11f0-8e61-2e6e3c7ee85d
Chinese (Mandarin)_HK_Flight_Attendant
英语：
English_Graceful_Lady
English_Insightful_Speaker
English_radiant_girl
English_Persuasive_Man
moss_audio_6dc281eb-713c-11f0-a447-9613c873494c
moss_audio_570551b1-735c-11f0-b236-0adeeecad052
moss_audio_ad5baf92-735f-11f0-8263-fe5a2fe98ec8
English_Lucky_Robot
日语：
Japanese_Whisper_Belle
Serene_Woman
moss_audio_24875c4a-7be4-11f0-9359-4e72c55db738
moss_audio_7f4ee608-78ea-11f0-bb73-1e2a4cfcd245
moss_audio_c1a6a3ac-7be6-11f0-8e8e-36b92fbb4f95
speed float
合成音频的语速，取值越大，语速越快。范围 [0.5,2]，默认 1.0

vol float
合成音频的音量，取值越大，音量越高。范围 (0,10]，默认 1.0

pitch int
合成音频的语调，范围 [-12,12]，默认 0，其中 0 为原音色输出

emotion string
控制合成语音的情绪；
参数范围 ["happy", "sad", "angry", "fearful", "disgusted", "surprised", "calm"]，分别对应 7 种情绪：高兴，悲伤，愤怒，害怕，厌恶，惊讶，中性
模型会根据输入文本自动匹配合适的情绪，一般无需手动指定
该参数仅对 speech-2.5-hd-preview ， speech-2.5-turbo-preview ， speech-02-hd ， speech-02-turbo ， speech-01-turbo ， speech-01-hd 模型生效
english_normalization bool
支持英语文本规范化，开启后可提升数字阅读场景的性能，但会略微增加延迟，默认 false

audio_setting object
sample_rate int
生成音频的采样率。可选 [8000, 16000, 22050, 24000, 32000, 44100]，默认 32000

bitrate int
生成音频的比特率。可选 [32000, 64000, 128000, 256000]，默认 128000。该参数仅对 mp3 格式的音频生效

format string
生成音频的格式。可选 [mp3, pcm, flac]，默认 mp3

channel int
生成音频的声道数。可选 [1, 2]，其中 1 为单声道，2 为双声道，默认 2

pronunciation_dict object
tone list
定义需要特殊标注的文字或符号对应的注音或发音替换规则。在中文文本中，声调用数字表示，一声为 1，二声为 2，三声为 3，四声为 4，轻声为 5
示例如下：
["燕少飞/(yan4)(shao3)(fei1)", "达菲/(da2)(fei1)", "omg/oh my god"]

language_boost string
是否增强对指定的小语种和方言的识别能力。默认值为 null，可设置为 "auto" 让模型自主判断。
可选值范围：[Chinese, Chinese,Yue, English, Arabic, Russian, Spanish, French, Portuguese, German, Turkish, Dutch, Ukrainian, Vietnamese, Indonesian, Japanese, Italian, Korean, Thai, Polish, Romanian, Greek, Czech, Finnish, Hindi, Bulgarian, Danish, Hebrew, Malay, Persian, Slovak, Swedish, Croatian, Filipino, Hungarian, Norwegian, Slovenian, Catalan, Nynorsk, Tamil, Afrikaans, auto]

voice_modify object
声音效果器设置

pitch int
音高调整（低沉/明亮），范围 [-100,100]，数值接近 -100，声音更低沉；接近 100，声音更明亮
图片描述
预览

intensity int
强度调整（力量感/柔和），范围 [-100,100]，数值接近 -100，声音更刚劲；接近 100，声音更轻柔
图片描述
预览

timbre int
音色调整（磁性/清脆），范围 [-100,100]，数值接近 -100，声音更浑厚；数值接近 100，声音更清脆
图片描述
预览

sound_effects string
音效设置，单次仅能选择一种，可选值：

spacious_echo（空旷回音）
auditorium_echo（礼堂广播）
lofi_telephone（电话失真）
robotic（电音）
aigc_watermark bool
控制在合成音频的末尾添加音频节奏标识，该参数仅对非流式合成生效，默认 False


返回体
task_id string
当前任务的 ID

file_id int64
任务创建成功后返回的对应音频文件的 ID。

当任务完成后，可通过 file_id 调用 文件检索接口 进行下载
当请求出错时，不返回该字段
注意：返回的下载 URL 自生成起 9 小时（32,400 秒）内有效，过期后文件将失效，生成的信息便会丢失，请注意下载信息的时间
task_token string
完成当前任务使用的密钥信息

usage_characters int
计费字符数

base_resp dict
本次请求的状态码及其详情

status_code int64
状态码

0: 正常
1002: 限流
1004: 鉴权失败
1039：触发 TPM 限流
1042: 非法字符超10%
2013: 参数异常
更多内容可查看错误码查询列表了解详情

status_msg string
状态详情

返回文件信息
输入文件
txt文件
输出文件如下所示

音频文件：文件格式遵从请求体设置
字幕文件：精确到句的字幕信息
额外信息 JSON 文件：音频文件相关的附加信息
json 文件
title
若该字段为空，则不输出该字段的文件

音频文件：文件格式遵从请求体设置
字幕文件：精确到句的字幕信息
额外信息 JSON 文件：音频文件相关的附加信息
content
若该字段为空，则不输出该字段的文件

音频文件：文件格式遵从请求体设置
字幕文件：精确到句的字幕信息
额外信息 JSON 文件：音频文件相关的附加信息
extra
若该字段为空，则不输出该字段的文件

音频文件：文件格式遵从请求体设置
字幕文件：精确到句的字幕信息
额外信息 JSON 文件：音频文件相关的附加信息
请求示例
curl --location 'https://api.minimaxi.com/v1/t2a_async_v2' \
--header "authorization: Bearer ${MINIMAX_API_KEY}" \
--header 'Content-Type: application/json' \
--data '{
    "model": "speech-2.5-hd-preview",
  "text": "真正的危险不是计算机开始像人一样思考，而是人开始像计算机一样思考。计算机只是可以帮我们处理一些简单事务。",
  "language_boost": "auto",
  "voice_setting": {
    "voice_id": "audiobook_male_1",
    "speed": 1,
    "vol": 1,
    "pitch": 1
  },
  "pronunciation_dict": {
    "tone": [
      "危险/dangerous"
    ]
  },
  "audio_setting": {
    "audio_sample_rate": 32000,
    "bitrate": 128000,
    "format": "mp3",
    "channel": 2
  },
  "voice_modify":{
      "pitch":0,
      "intensity":0,
      "timbre":0,
      "sound_effects":"spacious_echo"
    }
}'
返回示例
{
    "task_id": 95157322514444,
    "task_token": "eyJhbGciOiJSUz",
    "file_id": 95157322514444,
    "usage_characters":101,
    "base_resp": {
        "status_code": 0,
        "status_msg": "success"
    }
}













查询语音生成任务状态
GET
http://api.minimaxi.com/v1/query/t2a_async_query_v2
注：该 API 限制每秒最多查询 10 次。

请求头
Authorization string required
HTTP：Bearer Auth required

Security Scheme Type: http
HTTP Authorization Scheme: Bearer API_key，用于验证账户信息，可在 账户管理>接口密钥 中查看
Content-Type application/json required
请求体的媒介类型，请设置为 application/json，确保请求数据的格式为 JSON


请求体
task_id string required
任务 ID，提交任务时返回的信息


返回体
task_id string
任务 ID

status string
该任务的当前状态。

Processing：该任务正在处理中
Success：该任务已完成
Failed：任务失败
Expired：任务已过期
file_id int64
任务创建成功后返回的对应音频文件的 ID

当任务完成后，可通过file_id调用 文件检索 接口进行下载。
当请求出错时，不返回该字段
⚠️ 注意：返回的下载 URL 自生成起 9 小时（32,400 秒）内有效

base_resp dict
状态码及其详情

status_code int64
状态码

0: 请求成功
1000：未知错误
1001：超时
1002：触发限流
1004：鉴权失败
1042：非法字符超过 10%
2013：输入格式信息不正常
更多状态码信息请参考错误码查询

status_msg string
状态详情
请求示例
# 请先将 TASK_ID 和 MINIMAX_API_KEY 导入环境变量
curl --location "https://api.minimaxi.com/v1/query/t2a_async_query_v2?task_id=${TASK_ID}" \
--header "authorization: Bearer ${MINIMAX_API_KEY}" \
--header 'content-type: application/json'
返回示例
{
    "task_id": 95157322514444,
    "status": "Processing", 
    "file_id": 95157322514496,
    "base_resp": {
        "status_code": 0,
        "status_msg": "success"
    }
}