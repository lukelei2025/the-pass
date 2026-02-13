#!/bin/bash

# 小红书链接抓取脚本 (Bash版本)
#
# 用法：
#   bash scripts/fetch-xiaohongshu.sh "http://xhslink.com/o/9BlrhIXL1BD"

set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# User-Agent
USER_AGENT="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"

# 检查参数
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ 请提供小红书链接${NC}"
    echo ""
    echo "用法:"
    echo "  bash scripts/fetch-xiaohongshu.sh <url>"
    echo ""
    echo "示例:"
    echo '  bash scripts/fetch-xiaohongshu.sh "http://xhslink.com/o/9BlrhIXL1BD"'
    exit 1
fi

URL="$1"

echo -e "🔍 抓取小红书链接: ${YELLOW}${URL}${NC}"
echo ""

# 抓取HTML
echo "📝 正在抓取网页内容..."

HTML=$(curl -s -L \
    -H "User-Agent: ${USER_AGENT}" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
    -H "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8" \
    --max-time 15 \
    --compressed \
    "${URL}" 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 抓取失败: 网络错误${NC}"
    exit 1
fi

# 提取 og:title
TITLE=$(echo "$HTML" | grep -oP 'property="og:title" content="\K[^"]+' || echo "")

if [ -z "$TITLE" ]; then
    # 尝试 <title> 标签
    TITLE=$(echo "$HTML" | grep -oP '<title>\s*\K[^<]+' | sed 's/\s*-\s*小红书$//' || echo "")
fi

# 去除HTML实体
TITLE=$(echo "$TITLE" | sed 's/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g; s/&quot;/"/g; s/&#39;/'"'"'/g; s/&nbsp;/ /g')
TITLE=$(echo "$TITLE" | xargs) # 去除前后空格

# 提取作者
AUTHOR=$(echo "$HTML" | grep -oP '"nickname":"\K[^"]{2,50}' | head -1 || echo "")

if [ -z "$AUTHOR" ]; then
    AUTHOR=$(echo "$HTML" | grep -oP '"username":"\K[^"]{2,50}' | head -1 || echo "")
fi

# 输出结果
echo ""
echo "--- 抓取结果 ---"

if [ -n "$TITLE" ] && [ "$TITLE" != "小红书" ] && [ "${TITLE,,}" != "vlog" ]; then
    echo -e "${GREEN}✅ 标题: ${TITLE}${NC}"
    if [ -n "$AUTHOR" ]; then
        echo -e "👤 作者: ${YELLOW}${AUTHOR}${NC}"
    else
        echo "👤 作者: (未找到)"
    fi
    echo "🔧 方法: curl + regex"

    # 输出JSON格式
    echo ""
    echo "--- JSON 输出 ---"
    echo "{"
    echo "  \"title\": \"${TITLE}\","
    echo "  \"author\": \"${AUTHOR}\","
    echo "  \"method\": \"curl\""
    echo "}"
else
    echo -e "${RED}❌ 抓取失败: 无法提取标题${NC}"
    echo ""
    echo "调试信息:"
    echo "  HTML长度: $(echo "$HTML" | wc -c) 字节"
    echo "  是否包含og:title: $(echo "$HTML" | grep -c 'og:title' || echo 0)"
    echo "  是否包含title标签: $(echo "$HTML" | grep -c '<title>' || echo 0)"
fi
