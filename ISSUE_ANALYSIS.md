# 项目问题分析与风险评估（workbench）

本文档基于当前仓库代码与配置的审阅结果，聚焦安全、稳定性、成本与合规风险，并给出分层、可落地的改进建议。

## 1. 结论摘要

- 主要系统性风险来自“公开抓取 Worker + LLM 分类”组合：易被滥用为开放代理，导致成本失控与平台封禁风险。
- 前端结构清晰、状态管理合理，但对外端点 CORS 过宽且存在密钥暴露风险（仓库内出现真实 API Key）。
- Firestore 规则按用户隔离方向正确，但缺少字段级校验与防滥用机制（App Check、配额、速率限制）。

## 2. 架构与数据流概览

- 前端：`app/`（React + Vite + TypeScript + Tailwind + Zustand）
- 后端：`functions/`（Firebase Functions：GLM-4 分类）
- 边缘：`worker/`（Cloudflare Worker：标题抓取 + 分类 + 特定平台解析）

核心数据流：
1) PWA -> Cloudflare Worker (抓取标题/作者、分类)
2) PWA -> Firebase Functions (分类)
3) PWA -> Firestore (用户数据)

## 3. 关键风险清单（按优先级）

### P0 / P1 高风险

1. 公开端点无鉴权
- `functions/src/index.ts` 的 `classifyContent`、`worker/src/index.ts` 的 `handleClassify` 均可被匿名调用。
- 风险：滥用调用 GLM/Jina/Twitter 造成成本爆炸。

2. CORS 过宽
- Worker 和脚本普遍 `Access-Control-Allow-Origin: *`，Functions `cors({ origin: true })`。
- 风险：任意站点可调用你的 API。

3. 代理/SSRF 风险
- Worker 接受任意 `?url=`，通用抓取缺少域名与 IP 限制。
- 风险：被当作开放代理或用于 SSRF 探测。

4. 成本失控风险
- 缺少速率限制、幂等缓存与降级机制，失败重试导致“费用放大”。

5. 仓库出现真实 API Key
- `app/.env.local`、`app/.env.production` 存在真实 Firebase API Key。
- 风险：密钥泄露、被滥用。

6. 合规与平台条款风险
- 抓取 X/小红书/抖音/公众号/飞书等平台内容，可能违反平台条款并触发封禁。

### P2 中风险

1. 前端 `innerHTML`
- `app/src/main.tsx` 使用 `innerHTML` 输出初始化错误提示（当前内容固定）。
- 风险：潜在 XSS 风险（低）。

2. 输入/输出校验不足
- Functions/Worker 对请求体与 URL 缺少严格 schema 校验与长度限制。

3. 日志脱敏不足
- Worker 侧有较多 `console.log`，需避免记录正文内容或完整 URL。

4. 双分类端点导致策略漂移
- Functions 与 Worker 同时提供分类能力，易出现策略不一致或绕过风险。

## 4. 分层审计要点

### 前端

- 认证：Firebase Auth（Google Provider），PWA 场景使用 Redirect。
- 存储：已登录走 Firestore + 离线持久化，未登录走 localForage。
- 网络：统一走 Cloudflare Worker 获取标题与分类。

### 后端 / Worker

- Functions：分类端点公开，缺少鉴权与速率限制。
- Worker：抓取与分类合并，CORS 全开放，缺少 URL 白名单与 SSRF 防护。
- KV 缓存仅覆盖部分场景（Twitter/小红书），未覆盖分类与通用抓取。

## 5. 改进建议（可执行优先级）

### P0 立即执行

1) 统一对外入口 + 强鉴权
- 只保留一个对外分类入口（推荐 Worker），Functions 仅内部调用或关闭对外。
- Worker 校验 Firebase ID Token（JWT 验签），拒绝无 token 请求。

2) 收紧 CORS
- 仅允许前端域名 `Origin`，拒绝 `*`。

3) 密钥清理与旋转
- 删除仓库内真实 API Key，旋转 Firebase API Key。

### P1 本周执行

4) URL 白名单 + SSRF 防护
- 仅允许 HTTPS、限制域名范围、禁止私网/metadata IP。

5) 速率限制与配额
- Cloudflare WAF/Rate Limiting + Worker 内部按 user/IP 限流。

6) 幂等缓存与降级
- 分类与抓取结果引入幂等缓存，失败降级为仅标题/域名。

### P2 下个迭代

7) Schema 校验
- 对 `content` / `metadata` / `url` 做长度与类型限制；LLM 输出做枚举约束。

8) 日志脱敏
- 禁止记录正文、完整 URL 与作者信息。

9) Firestore 规则增强
- 增加字段白名单与大小限制，防止垃圾写入。

## 6. 参考定位（文件路径）

- `app/src/contexts/AuthContext.tsx`
- `app/src/store/useStore.ts`
- `app/src/lib/firestoreService.ts`
- `app/src/lib/llm.ts`
- `app/src/config/api.ts`
- `functions/src/index.ts`
- `worker/src/index.ts`
- `worker/src/xiaohongshu.ts`
- `firestore.rules`
- `app/.env.local`
- `app/.env.production`

## 7. 建议的下一步

- 先落地 P0（鉴权 + CORS + 密钥清理）。
- 若优先控制成本：追加“幂等缓存 + 限流 + 降级”。
- 若优先合规：做域名白名单 + 数据最小化 + 明确隐私披露。
