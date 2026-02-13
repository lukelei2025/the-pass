# 小红书链接抓取脚本

TypeScript/Bash 脚本集合，用于抓取小红书链接的标题和作者信息。

## 🚨 重要提示

由于小红书的反爬虫机制和网络限制，**推荐使用以下方式**：

### ✅ 推荐方案 1: 使用已部署的 Worker 服务

如果你已经部署了 Cloudflare Worker（参考 `worker/` 目录）：

```bash
# 假设你的 Worker 部署在 https://your-worker.your-subdomain.workers.dev
curl "https://your-worker.your-subdomain.workers.dev?url=http://xhslink.com/o/9BlrhIXL1BD"
```

### ✅ 推荐方案 2: 使用 MCP Web Reader（如果你有 MCP 环境）

直接使用 MCP `web_reader` 工具，这是目前最可靠的方式：

```bash
# 在 Claude Code 或其他 MCP 客户端中
# 调用 web_reader 工具并传入小红书链接
```

### ⚠️ 备用方案: 本地脚本

以下脚本在**某些网络环境**下可能工作，但不保证稳定性：

1. **fetch-xiaohongshu.ts** - 使用 fetch API
2. **fetch-xiaohongshu-simple.ts** - 使用 Node.js HTTP 模块
3. **fetch-xiaohongshu.sh** - Bash + curl 版本

## 脚本说明

### fetch-xiaohongshu.ts

完整的 TypeScript 实现，支持多种方法：

```bash
npx ts-node scripts/fetch-xiaohongshu.ts <url> [jina_api_key]
```

**特性：**
- ✅ Jina Reader API 集成（需要 API Key）
- ✅ Meta 标签解析
- ✅ 智能内容提取
- ✅ 15秒超时保护

**依赖：**
```bash
npm install -D ts-node typescript @types/node
```

### fetch-xiaohongshu-simple.ts

简化版，使用 Node.js 原生 HTTP 模块：

```bash
npx ts-node scripts/fetch-xiaohongshu-simple.ts <url>
```

**特性：**
- ✅ 无额外依赖
- ✅ 忽略 SSL 证书（仅开发环境）
- ⚠️ 可能被反爬虫拦截

### fetch-xiaohongshu.sh

Bash 脚本版本：

```bash
bash scripts/fetch-xiaohongshu.sh "<url>"
```

**特性：**
- ✅ 纯 Bash，无需 Node.js
- ✅ 使用 curl 和 regex
- ⚠️ 依赖 `grep -P`（Perl 正则表达式）

## 支持的链接格式

- `https://www.xiaohongshu.com/explore/{noteId}`
- `https://xhslink.com/{shortCode}`
- `http://xhslink.com/o/{shortCode}`

## 输出示例

```
🔍 抓取小红书链接: http://xhslink.com/o/9BlrhIXL1BD

--- 抓取结果 ---
✅ 标题: 测评｜期待了很久的桃红，没有让我失望
👤 作者: 迪克小馆

--- JSON 输出 ---
{
  "title": "测评｜期待了很久的桃红，没有让我失望",
  "author": "迪克小馆",
  "method": "jina_reader"
}
```

## 常见问题

### Q: 为什么脚本无法抓取内容？

**A:** 小红书有反爬虫机制，可能的解决方案：
1. 使用已部署的 Worker 服务
2. 配置代理
3. 尝试不同的 User-Agent
4. 使用 MCP Web Reader

### Q: 如何获取 Jina API Key？

**A:**
1. 访问 [Jina AI](https://jina.ai/)
2. 注册账号
3. 在 Dashboard 获取 API Key
4. 使用时传入：`npx ts-node scripts/fetch-xiaohongshu.ts <url> YOUR_API_KEY`

### Q: HTTP 451 错误是什么？

**A:** HTTP 451 表示"因法律原因无法提供"，这通常意味着：
- 目标网站阻止了访问
- 需要使用代理或其他方式绕过

## 技术实现细节

### 抓取方法优先级

1. **Jina Reader API**（最高成功率）
   - 专门的网页解析服务
   - 处理动态内容
   - 需要 API Key

2. **Meta 标签解析**（备用）
   - 解析 `<meta property="og:title">`
   - 提取 `<title>` 标签
   - 解析 JavaScript 数据

3. **直接 HTTP 请求**（最后手段）
   - Node.js HTTP/HTTPS 模块
   - curl 命令行工具
   - 容易被拦截

### 作者提取策略

```typescript
// 优先级顺序
1. window.__INITIAL_STATE__.note.noteDetailMap
2. <script> 中的 "nickname" 字段
3. 正则表达式匹配用户名模式
```

## 部署建议

### 生产环境

1. **使用 Cloudflare Worker**
   - 参考项目中的 `worker/` 目录
   - 部署到 Cloudflare Workers
   - 享受全球 CDN 和低延迟

2. **配置缓存**
   - 使用 KV 存储缓存结果
   - 减少 API 调用
   - 提高响应速度

3. **监控和限流**
   - 添加请求日志
   - 实施速率限制
   - 监控错误率

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
