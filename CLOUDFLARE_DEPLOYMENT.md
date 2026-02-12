# Cloudflare Workers 部署指南

## 📦 快速部署

### 方式1：通过 Cloudflare Dashboard（推荐）

1. **登录 Cloudflare**
   访问 https://dash.cloudflare.com/

2. **创建 Worker**
   - 进入 `Workers & Pages`
   - 点击 `Create application`
   - 选择 `Create Worker`
   - 输入名称（如 `twitter-scraper`）
   - 点击 `Deploy`

3. **编辑代码**
   - 点击 `Edit code`
   - 将 `twitter-scraper-worker.js` 的内容复制进去
   - 点击 `Save and Deploy`

4. **配置环境变量（可选）**
   - 在 Worker 设置中添加 `JINA_API_KEY`
   - 获取 API Key: https://jina.ai/reader

5. **绑定 KV 命名空间（可选，用于缓存）**
   - 进入 `Workers KV`
   - 创建命名空间（如 `TWITTER_CACHE`）
   - 在 Worker 设置中绑定变量名 `CACHE`

### 方式2：通过 Wrangler CLI

```bash
# 1. 安装 Wrangler
npm install -g wrangler

# 2. 登录
wrangler login

# 3. 创建项目
mkdir twitter-scraper-worker
cd twitter-scraper-worker
npm init -y

# 4. 创建 wrangler.toml
cat > wrangler.toml << EOF
name = "twitter-scraper"
main = "twitter-scraper-worker.js"
compatibility_date = "2024-01-01"

# KV 命名空间绑定（可选）
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

# 环境变量（可选）
[vars]
# JINA_API_KEY = "your-api-key-here"
EOF

# 5. 创建 KV 命名空间（可选）
wrangler kv:namespace create "CACHE"

# 6. 部署
wrangler deploy
```

---

## 🎯 使用方式

### API 端点

部署后你会得到一个 URL，如：
```
https://twitter-scraper.your-subdomain.workers.dev
```

### 请求格式

```bash
GET https://twitter-scraper.your-subdomain.workers.dev?url=https://x.com/user/status/123
```

### 响应格式

```json
{
  "author": "极客杰尼",
  "username": "seekjourney",
  "title": "我给OpenClaw装上了任务系统，像人一样领任务干活",
  "url": "https://x.com/seekjourney/status/2020702633326264437",
  "tweet_id": "2020702633326264437",
  "method": "jina_reader",
  "cached": false
}
```

---

## 💡 使用示例

### JavaScript/TypeScript

```javascript
// 获取推文信息
const response = await fetch(
  'https://your-worker.workers.dev?url=https://x.com/seekjourney/status/2020702633326264437'
);
const data = await response.json();

console.log(data.author);   // "极客杰尼"
console.log(data.title);    // "我给OpenClaw装上了任务系统..."
```

### Python

```python
import requests

def get_tweet_info(tweet_url, worker_url="https://your-worker.workers.dev"):
    response = requests.get(worker_url, params={"url": tweet_url})
    return response.json()

# 使用
info = get_tweet_info("https://x.com/seekjourney/status/2020702633326264437")
print(f"{info['author']}: {info['title']}")
```

### cURL

```bash
curl "https://your-worker.workers.dev?url=https://x.com/seekjourney/status/2020702633326264437"
```

---

## ⚙️ 配置选项

### 环境变量

| 变量名 | 说明 | 是否必需 |
|--------|------|----------|
| `JINA_API_KEY` | jina.ai API Key | 可选，但推荐配置 |
| `CACHE` | KV 命名空间绑定 | 可选 |

### 速率限制

| 配置 | 速率限制 |
|------|----------|
| 无 API Key | 20 RPM |
| 免费 API Key | 200 RPM |
| Premium Key | 1000 RPM |

---

## 📊 优势

```
✅ 全球边缘部署，低延迟
✅ 无服务器，自动扩展
✅ 免费额度：每天 100,000 次请求
✅ 内置 KV 缓存
✅ 自动 HTTPS
✅ CORS 支持
```

---

## 🔧 故障排查

### 常见问题

**1. CORS 错误**
- Worker 已内置 CORS 支持，确保使用正确的请求头

**2. 速率限制**
- 配置 `JINA_API_KEY` 提升限额

**3. 缓存未生效**
- 确保正确绑定 KV 命名空间

**4. 获取失败**
- 检查 URL 格式是否正确
- 查看 Worker 日志：`wrangler tail`

---

## 📈 监控

在 Cloudflare Dashboard 中查看：
- 请求数量
- 错误率
- 响应时间
- KV 缓存命中率

---

## 🚀 下一步

1. 配置自定义域名
2. 设置访问日志
3. 添加速率限制（可选）
4. 配置 CDN 缓存策略

---

## 📝 相关链接

- Cloudflare Workers 文档: https://developers.cloudflare.com/workers/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- KV 存储: https://developers.cloudflare.com/kv/
