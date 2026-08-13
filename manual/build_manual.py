# -*- coding: utf-8 -*-
"""
虚拟仿真多人多地协同教学系统 — 操作手册 PDF 生成脚本
风格依据《操作手册制作指南.md》：深海军蓝(#0B2545) + 科技蓝(#1277D6) + 微软雅黑
运行：python manual/build_manual.py
"""
import os
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image,
    PageBreak, Table, TableStyle, KeepTogether, NextPageTemplate, ListFlowable, ListItem
)
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage

# ---------------------------------------------------------------- 路径
BASE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(BASE, "shots")
OUT = os.path.join(BASE, "虚拟仿真多人多地协同教学系统-操作手册.pdf")

# ---------------------------------------------------------------- 字体
FONT_NORMAL = "C:\\Windows\\Fonts\\msyh.ttc"
FONT_BOLD = "C:\\Windows\\Fonts\\msyhbd.ttc"
FONT_HEI = "C:\\Windows\\Fonts\\simhei.ttf"
pdfmetrics.registerFont(TTFont("MSYH", FONT_NORMAL, subfontIndex=0))
pdfmetrics.registerFont(TTFont("MSYHBD", FONT_BOLD, subfontIndex=0))
pdfmetrics.registerFontFamily("MSYH", normal="MSYH", bold="MSYHBD",
                               italic="MSYH", boldItalic="MSYHBD")

# ---------------------------------------------------------------- 配色
C_NAVY = colors.HexColor("#0B2545")
C_TECH = colors.HexColor("#1277D6")
C_LIGHT = colors.HexColor("#EEF3FA")
C_GRAY = colors.HexColor("#555555")
C_BORDER = colors.HexColor("#C9D6E8")
C_WHITE = colors.white

# ---------------------------------------------------------------- 版式
PAGE_W, PAGE_H = A4
MARGIN_L = 18 * mm
MARGIN_R = 18 * mm
MARGIN_T = 20 * mm
MARGIN_B = 18 * mm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

# ---------------------------------------------------------------- 样式
from reportlab.lib.styles import ParagraphStyle

STYLE_H1 = ParagraphStyle("H1", fontName="MSYHBD", fontSize=18, leading=26,
                          textColor=C_NAVY, spaceBefore=6, spaceAfter=10)
STYLE_H2 = ParagraphStyle("H2", fontName="MSYHBD", fontSize=13.5, leading=20,
                          textColor=C_TECH, spaceBefore=10, spaceAfter=6)
STYLE_H3 = ParagraphStyle("H3", fontName="MSYHBD", fontSize=11.5, leading=17,
                          textColor=C_NAVY, spaceBefore=6, spaceAfter=4)
STYLE_BODY = ParagraphStyle("BODY", fontName="MSYH", fontSize=10.5, leading=18,
                            textColor=colors.HexColor("#222222"), alignment=TA_JUSTIFY,
                            spaceAfter=4, firstLineIndent=0)
STYLE_BULLET = ParagraphStyle("BULLET", fontName="MSYH", fontSize=10.5, leading=17,
                               textColor=colors.HexColor("#222222"), spaceAfter=2)
STYLE_CAP = ParagraphStyle("CAP", fontName="MSYH", fontSize=9, leading=13,
                           textColor=C_GRAY, alignment=TA_CENTER, spaceBefore=3, spaceAfter=10)
STYLE_COVER_T = ParagraphStyle("COVERT", fontName="MSYHBD", fontSize=34, leading=46,
                               textColor=C_NAVY, alignment=TA_CENTER)
STYLE_COVER_SUB = ParagraphStyle("COVERSUb", fontName="MSYH", fontSize=15, leading=22,
                                 textColor=C_TECH, alignment=TA_CENTER)
STYLE_COVER_TAG = ParagraphStyle("COVERTAG", fontName="MSYH", fontSize=11, leading=18,
                                 textColor=C_GRAY, alignment=TA_CENTER)
STYLE_TOC = ParagraphStyle("TOC", fontName="MSYH", fontSize=11, leading=20,
                           textColor=colors.HexColor("#222222"))
STYLE_TBL = ParagraphStyle("TBL", fontName="MSYH", fontSize=9.5, leading=14,
                           textColor=colors.HexColor("#222222"))
STYLE_TBLB = ParagraphStyle("TBLB", fontName="MSYHBD", fontSize=9.5, leading=14,
                            textColor=C_WHITE)
STYLE_TBL_HEAD = ParagraphStyle("TBLH", fontName="MSYHBD", fontSize=9.5, leading=14,
                                 textColor=C_WHITE, alignment=TA_CENTER)

# ---------------------------------------------------------------- 通用组件
def img(path, max_w=CONTENT_W, max_h=150 * mm):
    full = os.path.join(SHOTS, path) if not os.path.isabs(path) else path
    with PILImage.open(full) as im:
        iw, ih = im.size
    r = min(max_w / iw, max_h / ih)
    return Image(full, width=iw * r, height=ih * r)


def fig(path, caption):
    return KeepTogether([img(path), Paragraph(caption, STYLE_CAP)])


def bullets(items):
    li = [ListItem(Paragraph(t, STYLE_BULLET), leftIndent=6, value="◆",
                   bulletColor=C_TECH) for t in items]
    return ListFlowable(li, bulletType="bullet", start="◆",
                        bulletFontName="MSYH", bulletFontSize=8,
                        leftIndent=16, bulletOffsetY=-1)


def info_box(title, text):
    title_p = Paragraph(f'<font color="white"><b>{title}</b></font>', STYLE_TBL)
    body_p = Paragraph(text, ParagraphStyle("IB", fontName="MSYH", fontSize=10,
                       leading=16, textColor=colors.HexColor("#1f3552")))
    t = Table([[title_p, body_p]], colWidths=[34 * mm, CONTENT_W - 34 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), C_TECH),
        ("BACKGROUND", (1, 0), (1, 0), C_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0, C_WHITE),
    ]))
    return t


def std_table(data, colWidths, header=True):
    rows = []
    if header:
        head = [Paragraph(str(c), STYLE_TBL_HEAD) for c in data[0]]
        rows.append(head)
        body = data[1:]
    else:
        body = data
    for r in body:
        rows.append([Paragraph(str(c), STYLE_TBL) for c in r])
    t = Table(rows, colWidths=colWidths, repeatRows=1 if header else 0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.4, C_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), C_NAVY),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ]
        for i in range(1, len(rows)):
            if i % 2 == 0:
                style.append(("BACKGROUND", (0, i), (-1, i), C_LIGHT))
    t.setStyle(TableStyle(style))
    return t


def h1(text):
    return Paragraph(text, STYLE_H1)


def h2(text):
    return Paragraph(text, STYLE_H2)


def h3(text):
    return Paragraph(text, STYLE_H3)


def p(text):
    return Paragraph(text, STYLE_BODY)


def sp(h=6):
    return Spacer(1, h)
# ---------------------------------------------------------------- 页面装饰
DOC_TITLE = "虚拟仿真多人多地协同教学系统"
DOC_SUB = "操作手册"


def cover_bg(canvas, doc):
    canvas.saveState()
    # 纯白封面（便于打印）
    canvas.setFillColor(C_WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # 顶部科技蓝细装饰条
    canvas.setFillColor(C_TECH)
    canvas.rect(0, PAGE_H - 6 * mm, PAGE_W, 6 * mm, fill=1, stroke=0)
    # 底部深海军蓝细条
    canvas.setFillColor(C_NAVY)
    canvas.rect(0, 0, PAGE_W, 3 * mm, fill=1, stroke=0)
    # 浅灰装饰圆点矩阵（打印友好，低墨量）
    canvas.setFillColor(colors.HexColor("#D9E2EF"))
    for r in range(6):
        for c in range(18):
            canvas.circle(20 * mm + c * 9 * mm, 30 * mm + r * 9 * mm, 0.8, fill=1, stroke=0)
    canvas.restoreState()


def normal_bg(canvas, doc):
    canvas.saveState()
    # 页眉深蓝条
    canvas.setFillColor(C_NAVY)
    canvas.rect(0, PAGE_H - 14 * mm, PAGE_W, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(C_TECH)
    canvas.rect(0, PAGE_H - 14 * mm, PAGE_W, 1.2 * mm, fill=1, stroke=0)
    # 页眉文字
    canvas.setFillColor(C_WHITE)
    canvas.setFont("MSYHBD", 9.5)
    canvas.drawString(MARGIN_L, PAGE_H - 9 * mm, DOC_TITLE + " · " + DOC_SUB)
    canvas.setFont("MSYH", 8.5)
    canvas.setFillColor(colors.HexColor("#9FC4E8"))
    canvas.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 9 * mm, DOC_SUB)
    # 页脚
    canvas.setStrokeColor(C_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_L, 12 * mm, PAGE_W - MARGIN_R, 12 * mm)
    canvas.setFillColor(C_GRAY)
    canvas.setFont("MSYH", 8.5)
    canvas.drawString(MARGIN_L, 7 * mm, "CollabXR · 智匠心云教")
    canvas.setFont("MSYHBD", 9)
    canvas.setFillColor(C_NAVY)
    canvas.drawRightString(PAGE_W - MARGIN_R, 7 * mm, f"第 {doc.page} 页")
    canvas.restoreState()


# ---------------------------------------------------------------- 文档框架
frame_cover = Frame(0, 0, PAGE_W, PAGE_H, leftPadding=0, rightPadding=0,
                    topPadding=0, bottomPadding=0, id="cover")
frame_normal = Frame(MARGIN_L, MARGIN_B + 4 * mm, CONTENT_W,
                     PAGE_H - MARGIN_T - MARGIN_B - 4 * mm,
                     leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                     id="normal")

doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=MARGIN_L, rightMargin=MARGIN_R,
                      topMargin=MARGIN_T, bottomMargin=MARGIN_B,
                      title=DOC_TITLE + "操作手册", author="CollabXR")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame_cover], onPage=cover_bg),
    PageTemplate(id="normal", frames=[frame_normal], onPage=normal_bg),
])
# ---------------------------------------------------------------- 故事流
story = []

# ===== 封面 =====
story.append(Spacer(1, 70 * mm))
story.append(Paragraph("虚拟仿真多人多地协同教学系统", STYLE_COVER_T))
story.append(Spacer(1, 6 * mm))
story.append(Paragraph("Virtual Simulation Multi-person Multi-location Collaborative Teaching System",
                      STYLE_COVER_SUB))
story.append(Spacer(1, 18 * mm))
story.append(Paragraph("操 作 手 册", ParagraphStyle("CVM", fontName="MSYHBD",
                      fontSize=22, leading=30, textColor=C_TECH, alignment=TA_CENTER)))
story.append(Spacer(1, 26 * mm))
story.append(Paragraph("三维课件制作 · AI数字人授课 · 多人多地协同 · WebXR沉浸式学习",
                      STYLE_COVER_TAG))
story.append(Spacer(1, 4 * mm))
story.append(Paragraph("版本 V1.0    |    2026 年 06 月    |    CollabXR 智匠心云教",
                      STYLE_COVER_TAG))
story.append(NextPageTemplate("normal"))
story.append(PageBreak())

# ===== 目录 =====
story.append(Paragraph("目　录", ParagraphStyle("TOCT", fontName="MSYHBD", fontSize=20,
                      leading=28, textColor=C_NAVY, alignment=TA_CENTER, spaceAfter=14)))

toc_items = [
    ("第一章　软件概览", "3"),
    ("第二章　登录与界面布局", "4"),
    ("第三章　用户与组织管理", "8"),
    ("第四章　资源管理", "11"),
    ("第五章　三维课件制作", "14"),
    ("第六章　AI 课件制作", "18"),
    ("第七章　课件审核与发布", "22"),
    ("第八章　课程授权与激活码系统", "24"),
    ("第九章　成绩管理", "28"),
    ("第十章　数据分析看板", "29"),
    ("第十一章　学生门户与课程学习", "30"),
    ("第十二章　元宇宙大厅（Pico / Unity 沉浸式客户端）", "34"),
    ("附录 A　角色—功能权限矩阵", "42"),
    ("附录 B　术语表", "43"),
]
toc_rows = []
for title, page in toc_items:
    dots = "·" * max(2, 60 - len(title) * 2)
    toc_rows.append([Paragraph(title, STYLE_TOC),
                     Paragraph(f'<font color="#9AA7B8">{dots}</font>', STYLE_TOC),
                     Paragraph(f'<font color="#0B2545"><b>{page}</b></font>',
                               ParagraphStyle("TOCP", fontName="MSYHBD", fontSize=11,
                               leading=20, textColor=C_NAVY, alignment=TA_LEFT))])
toc_table = Table(toc_rows, colWidths=[95 * mm, 55 * mm, 14 * mm])
toc_table.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
story.append(toc_table)
story.append(PageBreak())
# ===== 第一章 软件概览 =====
story.append(h1("第一章　软件概览"))
story.append(p("虚拟仿真多人多地协同教学系统（产品代号 CollabXR）是一套面向职业教育与培训领域的"
              "三维课件制作与 AI 数字人授课平台。平台以「上传 3D 模型 → 制作三维课件 → 生成 AI "
              "授课大纲 → 配置考题与配音 → 审核发布 → 学生在线学习」为核心工作流，支持传统虚拟仿真"
              "课程、AI 数字人课程以及 WebXR/VR 沉浸式学习，并具备多角色分级管理与多人多地协同能力。"))
story.append(sp(4))
story.append(h2("1.1 功能定位"))
story.append(bullets([
    "<b>三维课件制作</b>：基于 Three.js 的全屏编辑器，支持模型节点树、标注热点、相机/显隐/变换三轨道动画时间线、步骤编辑与 AI 结构整理。",
    "<b>AI 数字人授课</b>：基于 DeepSeek/豆包大模型一键生成授课大纲与考题，配合 Minimax/Azure/豆包 TTS 实现数字人语音授课。",
    "<b>多人多地协同</b>：多学校、多班级、多教师协同创作，超管/校管/教师/学生四级权限体系，支持元宇宙大厅多人在线。",
    "<b>沉浸式学习</b>：支持 WebXR 标准，可在 VR 头显中沉浸式体验课件，自动检测设备能力并降级回退至普通 3D 模式。",
]))
story.append(sp(6))
story.append(h2("1.2 技术栈"))
story.append(std_table([
    ["层级", "技术选型", "说明"],
    ["前端", "Next.js 14 + React 18 + Ant Design 5 + Three.js", "SSR + 客户端 3D 渲染"],
    ["后端", "Express 5 + TypeScript + Mongoose", "REST API + JWT 鉴权"],
    ["数据库", "MongoDB 6", "文档型存储，课件/课程/用户/文件"],
    ["AI 服务", "DeepSeek / 豆包 / 通义千问VL / Minimax / Azure", "大纲生成、智能标注、TTS 配音"],
    ["部署", "Docker Compose + Nginx", "前后端容器化，可选 HTTPS 代理"],
], colWidths=[24 * mm, 70 * mm, CONTENT_W - 94 * mm]))
story.append(sp(8))
story.append(info_box("提示",
    "本手册截图取自本地部署的演示环境（前端 http://localhost:3001，后端 http://localhost:4000）。"
    "不同角色登录后可见的菜单与数据范围不同，请以实际登录账号的权限为准。"))
story.append(PageBreak())

# ===== 第二章 登录与界面布局 =====
story.append(h1("第二章　登录与界面布局"))
story.append(p("平台采用「管理后台」与「三维编辑器」双入口设计，管理员与教师在登录页可选择登录目标；"
              "学生则通过独立的课程门户登录。本章介绍登录流程与各端界面布局。"))
story.append(sp(4))
story.append(h2("2.1 登录入口"))
story.append(p("在浏览器中访问平台地址（如 http://localhost:3001/login），进入登录页。页面提供两个登录目标："))
story.append(bullets([
    "<b>管理后台</b>：数据分析、用户管理、课程审核，适用于超级管理员与校级管理员。",
    "<b>三维编辑器</b>：资源管理、课件创作、AI 课程，适用于教师与内容创作者。",
]))
story.append(p("登录方式为「手机号 + 密码」，默认密码 123456，可由管理员重置。学生账号请点击页面底部"
              "「前往课程门户登录」进入学生门户。"))
story.append(fig("00_login.png", "图 2-1　平台登录页（双登录目标选择）"))
story.append(h2("2.2 管理后台布局"))
story.append(p("登录管理后台后进入「数据总览」页面。后台采用左侧导航 + 右侧内容区的经典布局，"
              "导航按「数据分析 / 用户管理 / 课程管理 / 课程授权 / 快捷入口」分组。"))
story.append(fig("01_admin_analytics.png", "图 2-2　管理后台数据总览页（主界面全景）"))
story.append(h3("2.2.1 顶部与侧栏"))
story.append(bullets([
    "<b>左上角</b>：平台名称 CollabXR 平台，及当前登录角色（如「管理后台 · 超级管理员」）。",
    "<b>左侧导航栏</b>：分组菜单，点击菜单项进入对应功能页面；「快捷入口」提供跨模块跳转。",
    "<b>右上角</b>：显示当前用户名与「退出」按钮。",
]))
story.append(h3("2.2.2 内容区"))
story.append(p("右侧内容区随导航切换。数据总览页包含「平台总览」统计卡片（学校数、课程数、学生数、"
              "成绩提交次数、学习人次）、「趋势与活跃」折线图、「Top 榜」与「课程明细」表格。"))
story.append(PageBreak())

story.append(h2("2.3 三维编辑器布局"))
story.append(p("在登录页选择「三维编辑器」目标登录，或从管理后台左侧「快捷入口 → 三维编辑器」跳转，"
              "进入编辑器。编辑器导航精简为「编辑器首页 / 资源管理 / 三维课件 / AI 课件」四项，"
              "右上角「返回管理后台」可切回后台。"))
story.append(fig("12_editor_three_courseware.png", "图 2-3　三维编辑器 — 三维课件列表页"))
story.append(h2("2.4 学生门户布局"))
story.append(p("学生通过 /portal/login 登录课程门户，门户顶部为「课程首页 / 我的学习」导航，"
              "主体为课程卡片广场，支持搜索与点击进入学习。"))
story.append(fig("17_portal_login.png", "图 2-4　学生课程门户登录页"))
story.append(PageBreak())
# ===== 第三章 用户与组织管理 =====
story.append(h1("第三章　用户与组织管理"))
story.append(p("用户与组织管理是平台运行的基础，包含学校管理、班级管理与人员管理三个子模块，"
              "由超级管理员与校级管理员负责维护。教师与学生账号均与「学校」和「班级」强绑定。"))
story.append(sp(4))
story.append(h2("3.1 角色权限体系"))
story.append(std_table([
    ["角色", "标识", "权限范围"],
    ["超级管理员", "superadmin", "全平台所有数据，管理学校、配额、激活码、元宇宙授权"],
    ["校级管理员", "schoolAdmin", "本校所有数据，管理本校教师与学生"],
    ["教师", "teacher", "本校学生管理，制作课件，查看本班成绩"],
    ["学生", "student", "查看已发布课程，参与学习与答题"],
], colWidths=[28 * mm, 28 * mm, CONTENT_W - 56 * mm]))
story.append(sp(6))
story.append(h2("3.2 学校管理"))
story.append(p("路径：管理后台左侧「用户管理 → 学校管理」。该页面用于维护接入平台的学校清单，"
              "是创建班级与人员的前提。"))
story.append(fig("02_admin_schools.png", "图 3-1　学校管理列表页"))
story.append(h3("3.2.1 新增学校"))
story.append(bullets([
    "点击右上角「新增学校」按钮，弹出新增表单。",
    "填写学校「名称」「代码」（如 SCHOOL001）「地址」「联系人」「启用状态」等字段。",
    "点击「确定」保存，列表自动刷新并按代码排序展示。",
]))
story.append(h3("3.2.2 编辑与删除"))
story.append(p("每行学校记录右侧提供「编辑」「删除」按钮。编辑可修改学校基本信息；"
              "删除前系统会校验该校是否仍存在班级或用户，存在时需先转移或清理关联数据。"))
story.append(sp(4))
story.append(h2("3.3 班级管理"))
story.append(p("路径：「用户管理 → 班级管理」。班级归属于某一学校，并可选关联班主任（教师）。"))
story.append(fig("03_admin_classes.png", "图 3-2　班级管理列表页"))
story.append(bullets([
    "点击「新增班级」，选择所属学校、填写班级名称（如「3年级1班」）、可选班主任。",
    "支持按学校 / 班主任筛选班级列表。",
    "每行提供「编辑」「删除」操作；删除班级前请先处理该班学生。",
]))
story.append(PageBreak())

story.append(h2("3.4 人员管理"))
story.append(p("路径：「用户管理 → 人员管理」。人员管理按角色分 Tab 展示：超管可见「校级管理员 / 教师 / 学生」"
              "三个 Tab，校管可见「教师 / 学生」两个 Tab，教师仅可见「学生」Tab。"))
story.append(fig("04_admin_users.png", "图 3-3　人员管理 — 校级管理员 Tab"))
story.append(h3("3.4.1 查询与筛选"))
story.append(bullets([
    "<b>关键字搜索</b>：在「搜索姓名/手机号/学号」框中输入关键字模糊查询。",
    "<b>学校筛选</b>：下拉选择学校，联动班级筛选。",
    "<b>班级筛选</b>：下拉选择班级，定位到具体班级成员。",
]))
story.append(h3("3.4.2 新增用户"))
story.append(bullets([
    "点击「新增用户」按钮，按角色显示对应字段（学校、班级、学号、密码等）。",
    "教师创建的用户强制为「学生」且绑定本校；校管只能创建教师或学生。",
    "未填密码时使用默认密码 123456；手机号需全局唯一。",
]))
story.append(h3("3.4.3 编辑、删除与配额"))
story.append(bullets([
    "「编辑」可修改姓名、手机号、班级、密码及存储配额（单位 GB，接口 PUT /api/users/:id/quota）。",
    "列表以进度条可视化展示每个用户「已用存储 / 配额」；超管不受配额限制。",
    "配额超限时该用户禁止上传新文件。「删除」会移除账号，关联资源按平台策略保留或清理。",
]))
story.append(h3("3.4.4 批量导入"))
story.append(p("支持下载标准 xlsx 模板（含字段说明页），上传 Excel 批量创建用户。"
              "超管需先选择目标学校；班级不存在时自动创建；系统逐行收集错误并返回失败明细，便于修正后重导。"))
story.append(PageBreak())
# ===== 第四章 资源管理 =====
story.append(h1("第四章　资源管理"))
story.append(p("资源管理是课件制作的素材库，承载 3D 模型、视频、图片、PDF、PPT、Word 等文件。"
              "平台提供两个资源入口：编辑器资源库（增强版，含虚拟文件夹）与公共资源管理（简化版）。"))
story.append(sp(4))
story.append(h2("4.1 编辑器资源库"))
story.append(p("路径：三维编辑器左侧「资源管理」（/editor/resources）。该页面是创作者的主力资源工作台，"
              "支持虚拟文件夹树、分块上传、ZIP 解压、3D 模型格式转换与封面管理。"))
story.append(fig("11_editor_resources.png", "图 4-1　编辑器资源库（卡片视图）"))
story.append(h3("4.1.1 文件夹管理"))
story.append(bullets([
    "支持虚拟文件夹树形结构与面包屑导航，可新建 / 重命名 / 删除文件夹。",
    "支持拖拽：将文件拖入文件夹移动，或拖回面包屑路径移出文件夹。",
]))
story.append(h3("4.1.2 文件上传"))
story.append(bullets([
    "<b>支持类型</b>：视频、图片、PDF、PPT、Word、3D 模型（FBX / OBJ / STL / GLB / STEP）。",
    "<b>大文件分块上传</b>：超过 80 MB 自动切分（50 MB / 块），分 init → chunk → complete 三段式上传。",
    "<b>ZIP 解压上传</b>：上传 .zip 自动解压并批量入库。",
    "<b>3D 模型格式转换</b>：FBX / OBJ / STL 自动转换为 GLB；可配置缩放倍数（默认 ÷1000）；FBX 支持朝向校正（绕 X 轴 -90°）。",
    "<b>STEP 模型转换</b>：上传 STEP 文件，服务端调用转换器生成 GLB。",
]))
story.append(h3("4.1.3 封面与配额"))
story.append(bullets([
    "GLB 模型上传后自动截取缩略图（不计入存储配额），支持手动替换封面图片。",
    "顶部显示「已用 / 总配额」进度条（调用 /api/files/storage-usage）；超管账号不限容量。",
    "支持列表 / 卡片视图切换、多选批量删除、图片视频在线预览、GLB 跳转独立查看器、文件下载。",
]))
story.append(PageBreak())

story.append(h2("4.2 公共资源管理"))
story.append(p("路径：管理后台「快捷入口 → 资源管理」（/resources）。功能与编辑器资源库基本一致，"
              "但不含文件夹管理，提供「我的资源 / 公共资源」双 Tab。"))
story.append(fig("16_resources.png", "图 4-2　公共资源管理 — 我的资源列表"))
story.append(bullets([
    "<b>我的资源</b>：当前用户私有文件，仅本人及有权限的管理员可见。",
    "<b>公共资源</b>：超管可将文件设置为 visibility: public，作为全平台共享素材，且不占用个人存储配额。",
    "支持按类型筛选、按文件名搜索、查看、验证 GLB、下载与删除操作。",
]))
story.append(h2("4.3 GLB 模型查看器"))
story.append(p("在资源列表中点击 GLB 模型的「查看」按钮，跳转至独立查看器页面（/resources/viewer/model），"
              "可独立旋转、缩放、平移浏览 3D 模型，便于在制作课件前确认模型细节。"))
story.append(info_box("提示",
    "上传 3D 模型后请耐心等待格式转换与缩略图生成完成，再进入三维课件编辑器关联该模型；"
    "若缩略图未生成，可在资源卡片上手动替换封面。"))
story.append(PageBreak())
# ===== 第五章 三维课件制作 =====
story.append(h1("第五章　三维课件制作"))
story.append(p("三维课件是平台的核心内容形态，基于 Three.js 全屏编辑器制作，承载模型展示、标注热点、"
              "动画时间线与步骤说明。制作完成后可提交审核并发布给学生学习。"))
story.append(sp(4))
story.append(h2("5.1 课件列表管理"))
story.append(p("路径：三维编辑器「三维课件」（/editor/three-courseware）。以卡片形式展示课件封面、"
              "名称、描述、审核状态与版本号，支持搜索、编辑元信息与删除。"))
story.append(fig("12_editor_three_courseware.png", "图 5-1　三维课件列表（卡片网格）"))
story.append(bullets([
    "<b>状态标识</b>：草稿（灰）/ 待审核（蓝）/ 已通过（绿）/ 已拒绝（红）。",
    "<b>卡片操作</b>：提交审核（纸飞机图标）、修改信息（铅笔）、删除（垃圾桶）；点击卡片进入编辑器。",
    "点击右上角「新建课件」可创建新课件。",
]))
story.append(h2("5.2 新建课件"))
story.append(bullets([
    "点击「新建课件」，填写课件名称与描述。",
    "关联已上传的 3D 模型文件（GLB / FBX / OBJ），作为课件主体模型。",
    "保存后跳转至全屏编辑器进入内容创作。",
]))
story.append(PageBreak())

story.append(h2("5.3 三维课件编辑器"))
story.append(p("路径：/admin/three-courseware/[id] 或 /editor/three-courseware/[id]（全屏编辑器）。"
              "编辑器基于 Three.js 构建，左侧为模型节点树与功能面板，中央为 3D 视口，"
              "右侧为属性与时间线面板，顶部为工具栏。"))
story.append(fig("13_three_courseware_editor.png", "图 5-2　三维课件编辑器主界面"))
story.append(h3("5.3.1 模型加载与查看"))
story.append(bullets([
    "支持加载 GLB / FBX / OBJ 格式模型，自动解析节点树。",
    "左侧「模型结构」面板展示节点树，可折叠 / 展开 / 显隐切换，支持搜索节点名。",
    "视口支持轨道控制：旋转、缩放、平移；顶部「对焦所选 / 隔离所选 / 显示全部」快速定位节点。",
    "「设置」可调整场景背景、环境光、材质参数；「标签开/关」控制热点标签显隐。",
]))
story.append(h3("5.3.2 标注（热点）系统"))
story.append(bullets([
    "在模型任意位置添加标注热点（Annotation / Hotspot）。",
    "每个热点包含名称、描述文本、关联媒体（图片 / 视频）；点击后展示详情弹窗。",
    "右侧「添加标注」面板配置热点属性，视口中实时显示热点标签。",
]))
story.append(h3("5.3.3 动画时间线编辑"))
story.append(p("编辑器提供三条独立轨道，精确控制每一帧的课件状态："))
story.append(std_table([
    ["轨道类型", "功能说明"],
    ["相机动画轨道", "关键帧记录相机位置 / 朝向 / 焦点，制作流畅的镜头切换动画。"],
    ["显隐轨道", "控制模型各节点在不同时间帧的显示 / 隐藏状态，用于分解展示。"],
    ["变换轨道", "控制模型节点在不同帧的位置 / 旋转 / 缩放变换。"],
], colWidths=[36 * mm, CONTENT_W - 36 * mm]))
story.append(bullets([
    "「添加关键帧」在当前时间点记录轨道状态；时间轴可拖拽定位。",
    "「添加步骤」将课件按步骤组织，每步对应一段说明与模型状态。",
    "顶部「播放 / 上一步 / 下一步 / 开始录制 / 复位」用于预览动画效果。",
]))
story.append(PageBreak())

story.append(h3("5.3.4 步骤编辑"))
story.append(bullets([
    "课件按「步骤（Step）」组织内容，每步对应一段说明文字。",
    "每步可关联标注、相机视角与模型显隐/变换状态，形成完整教学演示序列。",
    "步骤顺序可在时间线中调整，配合播放按钮逐步演示。",
]))
story.append(h3("5.3.5 AI 辅助功能"))
story.append(bullets([
    "<b>模型结构整理</b>（QwenVL 视觉大模型）：自动识别并重命名模型节点，让节点树更易读。",
    "<b>单零件识别</b>：AI 分析单个节点外观并命名。",
    "<b>标注摘要生成</b>：基于已有标注自动生成课件摘要。",
    "入口位于左侧工具栏「AI 智能整理」按钮。",
]))
story.append(h3("5.3.6 保存与封面"))
story.append(bullets([
    "编辑后的模型数据（动画 / 标注 / 修改几何体）保存为 modified.glb 文件。",
    "自动截取当前视图作为课件封面缩略图。",
    "顶部「保存」按钮持久化课件；「导出」可导出课件数据。",
]))
story.append(info_box("提示",
    "时间线动画制作建议先在视口调整好目标状态，再点击「添加关键帧」记录；"
    "三条轨道相互独立，可分别录制相机、显隐与变换，组合出丰富的演示效果。"))
story.append(PageBreak())
# ===== 第六章 AI 课件制作 =====
story.append(h1("第六章　AI 课件制作"))
story.append(p("AI 课件是在三维课件基础上，叠加 AI 生成的授课大纲、考题与 TTS 语音配音，"
              "形成可由数字人自动授课的完整课程。制作完成后发布为公开链接供学生学习。"))
story.append(sp(4))
story.append(h2("6.1 课程列表"))
story.append(p("路径：三维编辑器「AI 课件」（/editor/ai-course）。卡片展示 AI 课件封面、标题、"
              "关联三维课件、状态与版本，支持搜索与删除。"))
story.append(fig("15_editor_ai_course.png", "图 6-1　AI 课件列表"))
story.append(bullets([
    "卡片显示审核状态（草稿 / 待审核 / 已通过 / 已拒绝）与版本号。",
    "点击「编辑课程」进入 AI 课件编辑器；支持搜索名称 / 主题。",
    "点击「新建 AI 课件」可创建新课程。",
]))
story.append(h2("6.2 新建 AI 课件"))
story.append(bullets([
    "填写课程名称、描述。",
    "关联已制作好的三维课件（必选），作为授课的 3D 内容载体。",
    "保存后进入 AI 课件编辑器。",
]))
story.append(PageBreak())

story.append(h2("6.3 AI 课件编辑器"))
story.append(p("路径：/admin/ai-course/[id]（全屏编辑器）。编辑器采用左右分栏 + 右侧属性面板的三栏布局："
              "顶部工具栏、左侧大纲编辑器、中央三维预览、右侧属性编辑。"))
story.append(fig("14_ai_course_editor.png", "图 6-2　AI 课件编辑器主界面"))
story.append(h3("6.3.1 顶部工具栏"))
story.append(bullets([
    "<b>刷新 / 保存</b>：刷新预览或保存课程进度。",
    "<b>AI 生成初稿</b>：根据课程名称与关联模型，一键生成完整授课大纲。",
    "<b>预览播放</b>：内置预览播放器，随时预览完整授课效果。",
    "<b>考题管理</b>：进入考题编辑面板，配置配套习题。",
    "<b>发布分享</b>：填写发布配置并生成公开访问链接。",
]))
story.append(h3("6.3.2 课程基本信息"))
story.append(p("顶部表单填写课程元信息：课程名称、课程主题、受众、时长（分钟）、语言（默认 zh-CN）。"
              "这些信息会作为 AI 生成大纲的输入提示。"))
story.append(h3("6.3.3 左侧大纲编辑器"))
story.append(bullets([
    "课程内容按「段落 → 步骤」两级结构组织。",
    "每个步骤支持多种内容类型：text（文字）、image（配图）、video（视频）、3d-view（关联 3D 视角）。",
    "段落 / 步骤支持拖拽排序，可添加、编辑、删除。",
]))
story.append(h3("6.3.4 中央三维预览"))
story.append(bullets([
    "实时渲染关联三维课件的 3D 模型，可重新加载、重置视角、全屏。",
    "选中某步骤时，预览自动切换到该步骤对应的 3D 视角与模型状态。",
]))
story.append(h3("6.3.5 右侧属性面板"))
story.append(bullets([
    "编辑选中步骤的详细属性：标题、正文、配图、TTS 文本等。",
    "实时关联右侧 3D 预览视角，所见即所得。",
]))
story.append(PageBreak())

story.append(h2("6.4 AI 功能（DeepSeek / 豆包大模型）"))
story.append(bullets([
    "<b>一键生成授课大纲</b>：点击「AI 生成初稿」，根据课件名称与关联模型自动生成段落与步骤结构。",
    "<b>AI 生成考题</b>：自动为每个段落生成配套习题，减少出题工作量。",
    "<b>AI 生成配图</b>：基于大纲图片描述生成提示词，调用豆包文生图模型生成课程配图。",
]))
story.append(h2("6.5 考题编辑"))
story.append(p("点击顶部「考题管理」进入考题面板，支持两类题型："))
story.append(std_table([
    ["题型", "说明"],
    ["理论题", "选择 / 判断题，用于知识点检验。"],
    ["互动题", "关联 3D 模型节点，要求学生在 3D 模型上点击正确零件作答。"],
], colWidths=[28 * mm, CONTENT_W - 28 * mm]))
story.append(h2("6.6 TTS 语音配置"))
story.append(bullets([
    "支持多 TTS 引擎：Minimax、Azure、豆包语音合成 2.0。",
    "可选择音色（男声 / 女声），为每个步骤配置 TTS 文本。",
    "发布时可「批量为所有步骤生成音频」（batchGenerateTTSForCourse）。",
]))
story.append(h2("6.7 预览播放"))
story.append(p("编辑器内置预览播放器（CoursePreviewPlayer），点击「预览播放」可按大纲逐步播放，"
              "同步 3D 视角切换、TTS 音频与字幕，随时验证授课效果后再发布。"))
story.append(info_box("提示",
    "AI 生成大纲后建议人工逐段校对，补充专业术语与本地化表述；TTS 批量生成耗时与步骤数成正比，"
    "请在非高峰时段执行。"))
story.append(PageBreak())
# ===== 第七章 课件审核与发布 =====
story.append(h1("第七章　课件审核与发布"))
story.append(p("课件创作完成后需经过审核流程方可对学生发布，确保内容质量与合规性。"
              "审核流程贯穿三维课件与 AI 课件两类内容。"))
story.append(sp(4))
story.append(h2("7.1 审核流程"))
story.append(p("标准审核流程如下："))
story.append(bullets([
    "<b>制作完成</b>：教师在编辑器中保存课件（状态为草稿 draft）。",
    "<b>提交审核</b>：在课件列表点击「提交审核」按钮，课件进入待审核队列（pending）。",
    "<b>审核通过 / 驳回</b>：超管或校管在审核页面审批，通过则状态变为 approved，驳回则 rejected 并填写原因。",
    "<b>下架</b>：已通过课件可下架（archived），从公开列表移除但数据保留。",
]))
story.append(h2("7.2 课件审核页面"))
story.append(p("路径：管理后台「课程管理 → 课件审核」（/admin/course-review）。按状态分 Tab 展示待审核、"
              "已通过、已拒绝与全部课件。"))
story.append(fig("06_admin_course_review.png", "图 7-1　课件审核页面（全部 Tab）"))
story.append(bullets([
    "每条记录展示课件信息（封面、名称、描述）、类型（AI 课件 / 三维课件）、提交人、提交时间、状态与审核意见。",
    "审核人可点击「通过」或「驳回」（驳回需填写审核意见），作者根据意见修改后重新提交。",
]))
story.append(h2("7.3 发布 AI 课件"))
story.append(p("AI 课件审核通过后，在编辑器点击「发布分享」进入发布配置："))
story.append(bullets([
    "填写发布配置（封面、简介、公开设置）。",
    "可选择是否批量生成 TTS 音频。",
    "发布后生成公开访问链接（/course/[publishId]），无需登录即可访问。",
    "发布内容作为快照（PublishedCourse）存储，修改原课件不影响已发布版本。",
]))
story.append(info_box("提示",
    "已发布的 AI 课件如需更新内容，需在原课件修改后重新发布新版本；旧版本快照仍可访问，"
    "便于回溯与版本管理。"))
story.append(PageBreak())

# ===== 第八章 课程授权与激活码系统 =====
story.append(h1("第八章　课程授权与激活码系统"))
story.append(p("平台通过「元宇宙大厅授权」与「激活码系统」两套机制控制学生对课程的访问权限，"
              "支持按学校授权与按学生激活两种粒度。"))
story.append(sp(4))
story.append(h2("8.1 元宇宙大厅授权"))
story.append(p("路径：管理后台「课程授权 → 元宇宙大厅授权」（/admin/enrollments）。"
              "超管将虚拟仿真课程授权给指定学校，学校未授权时该校学生无法访问对应课程。"))
story.append(fig("10_admin_enrollments.png", "图 8-1　元宇宙大厅授权页面"))
story.append(bullets([
    "顶部选择「学校」与「课程」，点击「授权」按钮建立授权关系。",
    "下方列表展示已授权记录，可按学校 / 课程筛选，并支持撤销授权。",
    "授权后，该校学生方可在门户看到并学习对应课程。",
]))
story.append(h2("8.2 激活码管理"))
story.append(p("路径：「课程授权 → 激活码管理」（/admin/activation-codes）。超管为指定课程生成激活码，"
              "控制有效期与可激活次数。"))
story.append(fig("08_admin_activation_codes.png", "图 8-2　激活码管理页面"))
story.append(bullets([
    "点击「生成激活码」按钮，选择课程、有效期、可激活次数等参数生成一批激活码。",
    "列表展示激活码、关联课程、使用情况（已用/总量）、有效期、状态与创建时间。",
]))
story.append(h2("8.3 激活记录"))
story.append(p("路径：「课程授权 → 激活记录」（/admin/activations）。查看激活码的使用明细，"
              "并可手动撤销指定用户的激活状态。"))
story.append(fig("09_admin_activations.png", "图 8-3　激活记录页面"))
story.append(bullets([
    "支持按课程、状态筛选，按用户名 / 学号 / 手机号 / 激活码搜索。",
    "每条记录展示用户、学校/班级、课程、激活码、激活时间、过期时间与最后验证时间。",
    "「刷新」按钮重新拉取最新激活状态。",
]))
story.append(PageBreak())

story.append(h2("8.4 学生激活课程"))
story.append(p("路径：「快捷入口 → 激活课程」（/activate）。学生凭激活码激活指定课程权限。"))
story.append(fig("21_activate.png", "图 8-4　学生激活课程页面"))
story.append(bullets([
    "在「选择课程」下拉中选择要激活的课程。",
    "在「激活码」输入框填入获取的激活码（格式 XXXX-XXXX-XXXX）。",
    "点击「立即激活」按钮，激活成功后即可在启动器或门户中访问该课程。",
]))
story.append(info_box("提示",
    "激活码与课程一一绑定，请勿跨课程使用；激活码有有效期与次数限制，过期或用尽后将无法激活。"
    "如需撤销某学生权限，管理员可在「激活记录」中手动撤销。"))
story.append(PageBreak())

# ===== 第九章 成绩管理 =====
story.append(h1("第九章　成绩管理"))
story.append(p("路径：管理后台「课程管理 → 成绩管理」（/scores）。成绩管理分「传统课程成绩」与"
              "「AI 课程答题成绩」两个 Tab，分别对应虚拟仿真课程与 AI 课程的考核数据。"))
story.append(sp(4))
story.append(h2("9.1 传统课程成绩"))
story.append(p("支持「简单课程」（按学习时长计）和「模块化课程」（按模块得分计）两类。"
              "不同角色看到的数据范围不同："))
story.append(bullets([
    "<b>学生视角</b>：查看自己各模块最高分与历次提交记录。",
    "<b>教师 / 校管视角</b>：班级成绩汇总表，点击查看单个学生的模块详情。",
    "<b>超管视角</b>：额外支持按学校 / 班级筛选。",
]))
story.append(fig("07_admin_scores.png", "图 9-1　成绩管理 — 传统课程成绩（班级成绩汇总）"))
story.append(p("页面提供课程、学校、班级三级下拉筛选与「查询」按钮，下方「班级成绩汇总」表格展示"
              "姓名、学号、总分、满分与提交时间。"))
story.append(h2("9.2 AI 课程答题成绩"))
story.append(bullets([
    "<b>统计卡片</b>：答题总次数、平均分、最高分、及格率。",
    "<b>明细列表</b>：课程名、得分、正确率、是否及格、答题时间。",
    "数据来源于学生答题提交记录（/api/quiz/submit），写入用户学习档案。",
]))
story.append(PageBreak())
# ===== 第十章 数据分析看板 =====
story.append(h1("第十章　数据分析看板"))
story.append(p("路径：管理后台「数据分析 → 数据总览」（/admin/analytics）。"
              "数据分析看板面向不同角色提供分层的数据洞察，是平台运营情况的核心监控视图。"))
story.append(sp(4))
story.append(fig("01_admin_analytics.png", "图 10-1　数据分析看板（超管视角）"))
story.append(h2("10.1 角色数据范围"))
story.append(std_table([
    ["角色", "可查看内容"],
    ["超管", "全平台学校数、用户数、课件数、访问量；趋势图"],
    ["校管", "本校各班级学习数据、课程完成率"],
    ["教师", "本班学生学习进度、成绩分布"],
    ["学生", "个人学习时长、答题统计"],
], colWidths=[24 * mm, CONTENT_W - 24 * mm]))
story.append(sp(6))
story.append(h2("10.2 看板组件"))
story.append(bullets([
    "<b>平台总览</b>：学校数、课程数、学生数、成绩提交总次数、学习人次等统计卡片。",
    "<b>趋势与活跃</b>：学习人次趋势折线图、活跃学生数图表，支持按时间范围（如近 14 天）切换。",
    "<b>Top 榜</b>：按人次 / 按提交次数的热门课程排行。",
    "<b>课程明细</b>：模块均分、班级均分等明细表格，可下钻查看。",
]))
story.append(info_box("提示",
    "看板数据存在短时缓存，若刚发布课件或刚有学生答题后数据未及时更新，可稍候刷新或切换时间范围重新加载。"))
story.append(PageBreak())

# ===== 第十一章 学生门户与课程学习 =====
story.append(h1("第十一章　学生门户与课程学习"))
story.append(p("学生门户是面向学习者的独立入口（/portal），与管理后台隔离，提供课程广场、我的学习与"
              "课程学习/答题功能。"))
story.append(sp(4))
story.append(h2("11.1 课程广场"))
story.append(p("路径：/portal。登录后进入课程首页，展示所有审核通过且已发布的课件（三维课件 + AI 课件），"
              "支持关键字搜索。"))
story.append(fig("18_portal_home.png", "图 11-1　学生门户 — 课程广场"))
story.append(bullets([
    "课程卡片展示封面、标题、描述、创建者与学习次数。",
    "点击卡片进入课程学习页；顶部「课程首页 / 我的学习」切换视图。",
]))
story.append(h2("11.2 我的学习"))
story.append(p("路径：/portal/my-study。展示个人学习统计与答题成绩记录。"))
story.append(fig("19_portal_my_study.png", "图 11-2　学生门户 — 我的学习"))
story.append(bullets([
    "统计卡片：学习课程数、完成课程数、答题次数、平均分数。",
    "成绩记录表：课程名、得分、正确/总题数等明细。",
]))
story.append(PageBreak())

story.append(h2("11.3 课程详情与模型查看"))
story.append(p("在课程广场点击三维课件卡片，进入课程详情页（/portal/course/[id]）。"))
story.append(fig("22_portal_course_detail.png", "图 11-3　门户课程详情页"))
story.append(bullets([
    "顶部展示 3D 模型预览与交互标签（热点标注）。",
    "显示课程标题、描述、创建者、审核通过时间、标签数量、动画数量等元信息。",
    "点击「查看模型」进入全屏 3D 模型查看器。",
]))
story.append(fig("23_portal_viewer.png", "图 11-4　门户 3D 模型查看器（沉浸式浏览）"))
story.append(p("模型查看器（/portal/viewer/[id]）支持自由旋转、缩放、平移，点击热点查看标注详情，"
              "模型节点树导航可点击高亮对应零件。"))
story.append(h2("11.4 AI 课件公开播放"))
story.append(p("路径：/course/[publishId]（无需登录）。AI 课件发布后生成公开链接，提供三种播放模式："))
story.append(std_table([
    ["模式", "说明"],
    ["学习模式", "按大纲逐步播放，数字人授课，同步 3D 视角切换 + 音频 + 字幕。"],
    ["探索模式", "自由浏览 3D 模型，查看各热点标注详情。"],
    ["答题模式", "完成课程配套考题，提交后显示成绩与解析。"],
], colWidths=[28 * mm, CONTENT_W - 28 * mm]))
story.append(fig("20_course_player.png", "图 11-5　AI 课件公开播放器"))
story.append(bullets([
    "学习模式按段落/步骤顺序播放，自动切换 3D 视角、控制节点显隐/变换，TTS 音频 + 字幕同步。",
    "答题模式中理论题为单选/判断，互动题直接在 3D 模型上点击对应零件作答；提交至 /api/quiz/submit。",
    "每次访问自动累计 viewCount（访问次数），可生成分享二维码。",
]))
story.append(PageBreak())

# ===== 第十二章 元宇宙大厅与 WebXR =====
story.append(h1("第十二章　元宇宙大厅（Pico / Unity 沉浸式客户端）"))
story.append(p("元宇宙大厅是平台「AI+元宇宙智慧教学」方案中运行在 VR 一体机（Pico 设备）上的沉浸式学习客户端，"
              "基于 Unity 开发，与 CollabXR Web 平台共享同一套账号、资源与课件数据。Web 平台负责内容生产"
              "（资源上传 → 三维课件制作 → AI 课件大纲/考题/TTS → 审核发布），Pico 客户端负责沉浸式消费与协作授课。"))
story.append(p("核心使用链路：登录（教师/学生）→ 选择虚拟形象 → 进入元宇宙大厅 → 加入/创建房间（多人教学）"
              "或浏览教学资源 → 下载并在 VR 中播放三维课件 / AI 课件 → AI 数字人讲师空间对话答疑（语音 + 拍照视觉分析）。"))
story.append(sp(4))
story.append(h2("12.1 应用概述"))
story.append(bullets([
    "统一适配 VR 大屏比例（界面以 2380×1080 / 1980×1080 为基准设计）。",
    "玻璃拟态（毛玻璃 + 渐变）深色 UI 风格，所有面板悬浮于 3D 空间中。",
    "基于 WebGL 2.0 / WebXR，兼容 PC 端与移动端降级。",
    "与 Web 平台同一账号体系，登录后按角色（教师 / 学生）展示不同大厅能力。",
]))
story.append(h2("12.2 登录与角色认证"))
story.append(p("对应界面：login-inline（元宇宙教学大厅 · 登录）。登录沿用平台账号 + 密码 / JWT 体系，"
              "与 Web 端共用同一账号。"))
story.append(std_table([
    ["元素", "说明"],
    ["角色选择", "「教师 / 学生」二选一（单选按钮组，高亮态切换）"],
    ["账号输入", "用户名 + 密码"],
    ["密码可见", "「显示 / 隐藏」切换密码明文"],
    ["错误提示", "登录失败时显示「用户名或密码错误，请重试」红色提示条"],
    ["登录按钮", "提交认证，成功后进入虚拟形象选择或直接进入大厅"],
], colWidths=[30 * mm, CONTENT_W - 30 * mm]))
story.append(sp(6))
story.append(h2("12.3 虚拟形象选择"))
story.append(p("对应界面：avatar-selection-vr（VR 形象选择）。三栏式布局（左筛选 / 中预览 / 右列表），"
              "确认后保存所选形象，作为用户在多人房间中的 3D 虚拟身份。"))
story.append(bullets([
    "<b>顶部栏</b>：返回、页面标题「选择形象」、确认选择（未选中时禁用）。",
    "<b>左侧筛选面板</b>：性别（全部 / 男 / 女）、风格（全部 / 科幻 / 写实 / 魔幻 / 末日 / 卡通）。",
    "<b>中间预览区</b>：选中形象的大图预览 + 名称 + 标签（性别 / 风格）。",
    "<b>右侧形象列表</b>：2 列卡片网格（形象缩略图 + 名称），点击选中高亮。",
]))
story.append(PageBreak())
story.append(h2("12.4 元宇宙大厅"))
story.append(p("对应界面：lobby（元宇宙教学大厅，VR 大屏 2380×1080）。大厅是整个客户端的统一入口，"
              "承担身份展示、社交入口、资源分发三大职能。"))
story.append(bullets([
    "<b>顶部导航栏</b>：平台标题「元宇宙教学大厅」、用户名 + 角色、退出登录。",
    "<b>左侧个人信息面板</b>：3D 虚拟形象展示区（VR 环境中实时显示）、姓名、角色、「更换形象」按钮。",
    "<b>中间主内容区</b>：两个一级 Tab ——「在线房间」/「教学资源」。",
]))
story.append(h3("12.4.1 在线房间（多人教学入口）"))
story.append(bullets([
    "<b>快速加入</b>：输入房间号 → 快速加入。",
    "<b>创建房间</b>：教师创建新教学房间。",
    "<b>房间卡片列表</b>：房间名称、授课教师、状态（进行中 / 等待中）、已开始时长、加入房间按钮。",
    "进入房间即进入多人协作教学场景（见 12.9 节）。",
]))
story.append(h3("12.4.2 教学资源"))
story.append(p("见 12.5 节，提供 AI 课件 / 三维课件 / 通用资源三类内容的浏览、下载与播放。"))
story.append(PageBreak())

story.append(h2("12.5 教学资源浏览、下载与播放"))
story.append(p("对应界面：lobby 资源模块 + 媒体播放器 / 文件目录模态框。资源按三种模式一级切换："))
story.append(std_table([
    ["模式", "说明"],
    ["AI 课件", "平台发布的 AI 数字人授课课件"],
    ["三维课件", "平台制作的三维互动课件"],
    ["资源", "通用素材，支持类别筛选"],
], colWidths=[28 * mm, CONTENT_W - 28 * mm]))
story.append(p("「资源」模式支持类别筛选：全部 / 图片 / 视频 / PDF / 模型（OBJ / FBX / glTF）。"))
story.append(h3("12.5.1 资源卡片与下载"))
story.append(bullets([
    "卡片显示名称、描述、文件大小、下载状态。",
    "下载状态：未下载 / 下载中（进度条，模拟实时进度）/ 已下载。",
    "点击未下载资源开始下载；下载完成后打开播放窗口。",
    "文件目录模态框展示资源包内文件清单（名称、大小、类型）。",
]))
story.append(h3("12.5.2 媒体播放器"))
story.append(p("全屏悬浮窗（可拖拽），根据资源类型加载不同查看器："))
story.append(std_table([
    ["资源类型", "播放器"],
    ["AI 课件", "AI 智能课件系统（个性化授课体验）"],
    ["三维课件", "三维课件查看器（沉浸式 VR，见 12.6 节）"],
    ["图片", "高清图片查看器"],
    ["视频", "视频播放器"],
    ["PDF", "PDF 文档查看器"],
    ["模型", "交互式 3D 模型查看器"],
], colWidths=[30 * mm, CONTENT_W - 30 * mm]))
story.append(PageBreak())

story.append(h2("12.6 三维课件 VR 查看器"))
story.append(p("对应界面：integrated-vr-viewer-scaled 与 vr-3d-animation-integrated。"
              "这是 Pico 端播放平台「三维课件」的核心组件，将模型、动画时间线、标注、步骤完整还原到 VR 空间。"))
story.append(h3("12.6.1 整体布局"))
story.append(bullets([
    "<b>头部</b>：标题、飞屏按钮（见 12.10 节）、关闭。",
    "<b>左侧 · 动画列表</b>：列出该课件所有动画（如四冲程工作循环 / 装配过程演示 / 气门正时系统 / 燃油喷射系统 / 冷却系统循环 / 发动机爆炸视图），每项显示步骤数，点击切换。",
    "<b>中间 · 3D 模型区</b>：实时渲染模型，显示当前播放动画名与当前步骤。",
    "<b>右侧 · 标签列表与详情面板</b>：3D 标签列表 + 标签显隐切换 + 详情面板（见 12.7 节）。",
]))
story.append(h3("12.6.2 底部控制条"))
story.append(bullets([
    "<b>步骤时间线</b>：步骤卡片水平滚动，当前步骤放大高亮 + 发光，已完成步骤半透明 + 绿色勾选。",
    "<b>步骤进度条</b>与<b>步骤切换</b>：上一步 / 下一步。",
    "<b>动画播放</b>：播放 / 暂停（自动连播整段动画）。",
    "<b>复位</b>：回到第一步。",
]))
story.append(h3("12.6.3 模型控制"))
story.append(bullets([
    "<b>标签显示</b>：显示 / 隐藏全部标注。",
    "<b>爆炸视图</b>：爆炸 / 还原（分解展示模型内部结构）。",
    "各浮动面板（动画列表 / 播放控制器 / 步骤时间线）均可独立关闭，支持级联关闭。",
]))
story.append(PageBreak())

story.append(h2("12.7 3D 标注详情面板"))
story.append(p("对应界面：vr-3d-label-detail-panel。实现「点击 3D 标注热点 → 查看结构化讲解」的交互联动。"))
story.append(bullets([
    "<b>左侧 3D 模型区</b>：在模型对应位置悬浮标注点标签（如气缸盖、进气歧管、曲轴箱、排气管、火花塞），左右分布以避免遮挡。",
    "<b>右侧详情面板</b>：点击标签后显示对应详情，含功能描述、技术参数（材质 / 工作温度 / 密封压力 / 气门数量等键值对）、工作原理 / 结构特点 / 排放控制 / 维护要点等多段内容。",
    "<b>交互联动</b>：点击标签自动聚焦目标对象，详情面板淡入；面板支持垂直滚动浏览；点击关闭面板淡出，所有标签恢复显示。",
    "默认未选中时显示「点击标签查看详细信息」占位提示。",
]))
story.append(PageBreak())
story.append(h2("12.8 AI 数字人讲师（空间对话系统）"))
story.append(p("对应界面：vr-ai-teacher-spatial。AI 数字人是 AI 辅助教学的核心，以约 1.7 米高的 3D 虚拟讲师形象"
              "立于 VR 空间中，所有 UI 围绕角色悬浮布局。"))
story.append(h3("12.8.1 唤起与对话交互"))
story.append(bullets([
    "<b>唤起/关闭</b>：Pico 长按 A 键唤起或关闭 AI。",
    "角色周围浮现对话气泡（用户提问 / AI 回答）。",
    "<b>底部输入面板</b>：文本输入框 + 发送；拍照（B 键调起 VR 相机，手柄扳机键拍照）；快捷提问「图中是什么设备？」「如何操作？」「有什么注意事项？」。",
    "打字指示器：AI 思考 / 生成中动效。",
]))
story.append(h3("12.8.2 视觉智能（拍照分析）"))
story.append(bullets([
    "「拍照」打开 VR 相机取景器，手柄扳机键拍摄空间截图。",
    "删除 / 确定照片；确定后照片进入预览，提示用户输入针对照片的问题。",
    "AI 结合照片 + 问题进行多模态分析（设备结构识别、操作说明、技术参数讲解）。",
]))
story.append(h3("12.8.3 辅助功能按钮（角色顶部）"))
story.append(std_table([
    ["按钮", "功能"],
    ["隐藏 / 显示", "隐藏或显示对话内容"],
    ["清空", "清空当前对话（二次确认）"],
    ["历史", "打开 / 关闭右侧「对话历史」面板"],
], colWidths=[34 * mm, CONTENT_W - 34 * mm]))
story.append(PageBreak())

story.append(h2("12.9 多人协作教学"))
story.append(p("对应入口：大厅「在线房间」。进入房间后构建多人虚拟教室，打破时空限制实现远程协作。"))
story.append(h3("12.9.1 协作能力"))
story.append(bullets([
    "多人同处虚拟教室，教师主导授课、学生共享视角 / 参与讨论。",
    "<b>共享白板</b>：多人同时绘制，冲突检测与合并，支持保存。",
    "<b>3D 模型共同观看</b>：教师调整视角时所有学生端同步。",
    "<b>实时空间标注</b>：在 3D 空间中添加协作标记。",
]))
story.append(h3("12.9.2 实时通信（WebRTC）"))
story.append(bullets([
    "低延迟音视频（音频延迟 < 100ms）。",
    "3D 空间音频：按虚拟环境中说话者方位听到声音。",
]))
story.append(h3("12.9.3 虚拟形象与动作捕捉"))
story.append(bullets([
    "使用 12.3 节所选 3D 形象。",
    "基于 Pico 设备位置追踪，实时捕捉头部 / 手部 / 身体动作。",
    "骨骼绑定 + 动作预测保证网络抖动下的连续性。",
    "实例化渲染优化，支持最多 50 人同时在线。",
]))
story.append(h3("12.9.4 权限管理"))
story.append(bullets([
    "教师可控制学生麦克风、白板权限。",
    "支持全体静音 / 解除静音、对个别用户精细管理。",
]))
story.append(PageBreak())

story.append(h2("12.10 VR 飞屏（2D / 3D 内容空间投屏）"))
story.append(p("对应界面：查看器头部「飞屏」按钮。"))
story.append(bullets([
    "将 2D 内容（如三维课件查看窗、图片、PDF 页面）一键投射为 VR 空间中的浮动 3D 面板。",
    "面板可在空间中自由移动、缩放、旋转。",
    "为 VR 教学提供「把屏幕内容拽到空间里看」的全新交互方式。",
]))
story.append(sp(6))
story.append(h2("12.11 与云平台对接"))
story.append(p("Pico 客户端与 CollabXR Web 平台通过专用 API 对接，复用平台发布内容："))
story.append(std_table([
    ["接口", "用途"],
    ["GET /api/published-courses/client/list", "拉取已发布 AI 课件列表（封面、标题、publishId）"],
    ["GET /api/coursewares/client/list", "拉取三维课件列表（模型 URL、标注数据）"],
    ["GET /api/public/course/:publishId", "获取完整课程数据（含音频 URL，免登录）"],
    ["GET /api/public/files/:fileId", "文件代理访问（课件内资源引用，免登录）"],
], colWidths=[68 * mm, CONTENT_W - 68 * mm]))
story.append(h3("12.11.1 对接要点"))
story.append(bullets([
    "账号与角色（教师 / 学生）与平台统一，登录沿用账号 + 密码 / JWT。",
    "内部文件 URL 在对外接口自动转换为公网代理地址，供 VR 客户端直接加载。",
    "<b>激活码鉴权</b>：客户端通过平台激活码系统校验用户对课程的访问权限；元宇宙大厅入口需平台开启 metaverseAllowed 权限并通过授权鉴权。",
    "课件以发布快照（PublishedCourse）形式分发，保证网页端与客户端在对象映射、播放逻辑上完全一致；定位失败 / 资源缺失时记录告警并跳过，保证连续播放。",
]))
story.append(sp(6))
story.append(h2("12.12 性能与设备兼容性"))
story.append(bullets([
    "<b>渲染优化</b>：LOD 细节分级、遮挡剔除、纹理压缩、实例化渲染，保证 VR 流畅帧率与佩戴舒适度。",
    "<b>网络优化</b>：CDN 加速、几何 / 纹理 / 音频压缩、智能缓存与断点续传下载。",
    "<b>自适应渲染</b>：按设备性能与网络状况动态调整渲染质量。",
    "<b>跨平台</b>：WebXR 标准适配主流 VR 设备；PC 端（Chrome / Edge / Safari）与移动端响应式降级回退至普通 3D 模式。",
    "<b>设备能力检测</b>：自动识别 GPU / 设备能力，无 VR 能力时降级为普通 3D 浏览。",
]))
story.append(sp(8))
story.append(info_box("客户端交互数据流",
    "平台发布内容（PublishedCourse / Courseware / File / 激活码）→ Pico 登录（教师/学生）→ 选择虚拟形象 → "
    "元宇宙大厅 → 在线房间（多人协作教学：WebRTC + 形象动作捕捉 + 共享白板/同步视角）或 教学资源（下载缓存 → VR 播放："
    "三维课件查看器 / AI 课件播放 / 图片视频PDF模型查看器）→ AI 数字人讲师（语音 + 拍照视觉分析 + 3D 高亮联动）→ "
    "VR 飞屏（2D → 3D 空间面板）→ 学习行为 / 答题数据（成绩 / 分析看板）。"))
story.append(PageBreak())

# ===== 附录 A 角色—功能权限矩阵 =====
story.append(h1("附录 A　角色—功能权限矩阵"))
story.append(p("下表汇总各角色在平台各功能模块中的操作权限，便于权限规划与账号分配。"
              "● 表示具备该权限，— 表示无权限。"))
story.append(sp(4))
story.append(std_table([
    ["功能模块", "超级管理员", "校级管理员", "教师", "学生"],
    ["数据总览（全平台）", "●", "本校", "本班", "个人"],
    ["学校管理", "●", "—", "—", "—"],
    ["班级管理", "●", "●（本校）", "—", "—"],
    ["人员管理", "●", "●（本校师生）", "●（本班学生）", "—"],
    ["虚拟仿真课程", "●", "●", "●", "查看"],
    ["资源管理（私有）", "●", "●", "●", "—"],
    ["公共资源设置", "●", "—", "—", "—"],
    ["三维课件制作", "●", "●", "●", "—"],
    ["AI 课件制作", "●", "●", "●", "—"],
    ["课件审核", "●", "●（本校）", "—", "—"],
    ["成绩管理", "●", "●（本校）", "●（本班）", "个人"],
    ["激活码管理", "●", "—", "—", "—"],
    ["激活记录", "●", "—", "—", "—"],
    ["元宇宙大厅授权", "●", "—", "—", "—"],
    ["课程激活", "—", "—", "—", "●"],
    ["课程学习/答题", "—", "—", "—", "●"],
    ["元宇宙大厅", "●", "●", "●", "需授权"],
], colWidths=[44 * mm, 24 * mm, 24 * mm, 22 * mm, CONTENT_W - 114 * mm]))
story.append(PageBreak())

# ===== 附录 B 术语表 =====
story.append(h1("附录 B　术语表"))
story.append(p("本附录收录平台常用术语与缩略语，便于阅读本手册及平台界面时对照理解。"))
story.append(sp(4))
story.append(std_table([
    ["术语 / 缩略语", "释义"],
    ["CollabXR", "平台产品代号，即虚拟仿真多人多地协同教学系统。"],
    ["三维课件", "基于 3D 模型制作的交互课件，含标注、动画时间线与步骤。"],
    ["AI 课件", "在三维课件基础上叠加 AI 大纲、考题与 TTS 配音的数字人授课课程。"],
    ["PublishedCourse", "已发布课程快照，发布后修改原课件不影响已发布版本。"],
    ["publishId", "AI 课件发布后生成的公开访问标识，用于 /course/[publishId] 链接。"],
    ["标注 / 热点", "Annotation / Hotspot，附着在模型上的信息点，可关联文字/图片/视频。"],
    ["时间线轨道", "动画编辑的三条独立轨道：相机、显隐、变换。"],
    ["TTS", "Text To Speech，文本转语音，平台支持 Minimax、Azure、豆包语音合成 2.0。"],
    ["WebXR", "Web 扩展现实标准，支持在浏览器/VR 头显中沉浸式体验 3D/VR 内容。"],
    ["元宇宙大厅", "多人多地在线的虚拟协同空间，需 metaverseAllowed 权限。"],
    ["激活码", "超管生成、学生用于激活课程权限的授权码，含有效期与次数限制。"],
    ["Enrollment", "课程授权记录，将虚拟仿真课程授权给指定学校。"],
    ["JWT", "JSON Web Token，平台登录鉴权令牌，存储于浏览器 localStorage。"],
    ["GLB", "glTF Binary，3D 模型二进制格式，平台课件的标准模型格式。"],
    ["STEP", "CAD 三维模型交换格式，上传后服务端转换为 GLB。"],
    ["模块化课程", "按模块计分的虚拟仿真课程，区别于按时长计的简单课程。"],
], colWidths=[40 * mm, CONTENT_W - 40 * mm]))
story.append(sp(10))
story.append(Paragraph("— 全文完 —", ParagraphStyle("END", fontName="MSYHBD", fontSize=11,
                      leading=18, textColor=C_GRAY, alignment=TA_CENTER)))

# ---------------------------------------------------------------- 构建
doc.build(story)
print("OK ->", OUT)
