# Worker 本地测试指南

## 快速开始

### 方式一：使用环境变量（推荐）

```bash
cd worker
npx wrangler dev src/index.ts --local --var GLM_API_KEY:你的智谱AI_API_KEY
```

然后在浏览器访问：
```
http://localhost:8787/?url=https://www.xiaohongshu.com/api/test
```

### 方式二：本地测试（不用 wrangler）

```bash
# 1. 安装依赖
cd worker
npm install

# 2. 本地运行
node src/index.ts

# 3. 测试（在另一个终端）
curl "http://localhost:9999/?url=https://www.xiaohongshu.com/api/test"
```

---

## 配置步骤

### 1. 获取智谱 AI API Key

1. 访问 [智谱 AI 开放平台](https://open.bigmodel.cn/usercenter/apikeys)
2. 登录你的账号
3. 创建新的 API Key
4. 复制 API Key

### 2. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env.local

# 编辑配置
vim .env.local
# 填入你的 GLM_API_KEY
```

---

## 生产部署注意事项（避免覆盖 Dashboard Secrets）

### 必须使用 --keep-vars

Cloudflare Dashboard 中的 Secrets（例如 GLM_API_KEY、JINA_API_KEY）会在部署时被本地配置覆盖。
为避免清空线上密钥，部署时必须带上：

```bash
npx wrangler deploy --keep-vars
```

### 推荐做法

- Secrets 永远只在 Cloudflare Dashboard 或 `wrangler secret put` 中配置
- 不要在 `wrangler.toml` 里写 `GLM_API_KEY` 或 `JINA_API_KEY`

### 3. 启动 Worker

```bash
cd worker
npx wrangler dev src/index.ts --local
```

---

## 测试检查单

### ✅ 平台识别
- [ ] 微信文章：`?url=https://mp.weixin.qq.com/s/xxx`
- [ ] Twitter 链接：`?url=https://twitter.com/xxx`
- [ ] 小红书链接：`?url=https://www.xiaohongshu.com/xxx`

### ✅ LLM 分类
- [ ] 返回分类：`ideas/work/personal/external/others`
- [ ] 包含 reasoning 字段

### ✅ 完整应用
- [ ] 前端：http://localhost:5173
- [ ] 登录功能正常

---

**配置好 GLM_API_KEY 后告诉我，我帮你重新启动 Worker！**
