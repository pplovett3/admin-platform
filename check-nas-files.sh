#!/bin/bash
# ============================================
# 检查 NAS 上文件是否完整
# ============================================

echo "=========================================="
echo "检查 NAS 上的文件完整性"
echo "=========================================="

cd /volume1/docker/admin-platform/web

echo ""
echo "检查关键目录和文件..."
echo ""

# 检查 _utils 目录
if [ -d "app/_utils" ]; then
    echo "✓ app/_utils 目录存在"
    if [ -f "app/_utils/api.ts" ]; then
        echo "  ✓ app/_utils/api.ts 存在"
    else
        echo "  ✗ app/_utils/api.ts 不存在！"
    fi
else
    echo "✗ app/_utils 目录不存在！"
fi

# 检查 _lib 目录
if [ -d "app/_lib" ]; then
    echo "✓ app/_lib 目录存在"
    if [ -f "app/_lib/api.ts" ]; then
        echo "  ✓ app/_lib/api.ts 存在"
    else
        echo "  ✗ app/_lib/api.ts 不存在！"
    fi
else
    echo "✗ app/_lib 目录不存在！"
fi

# 列出 app 目录结构
echo ""
echo "app 目录结构："
ls -la app/ | head -20

echo ""
echo "检查完成！"
echo ""

