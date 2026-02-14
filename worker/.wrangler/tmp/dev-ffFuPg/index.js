var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-FHF7yu/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/platforms/base.ts
var BasePlatform = class {
  static {
    __name(this, "BasePlatform");
  }
  /**
   * 检查是否能处理此 URL（默认返回 false）
   */
  canHandle(url) {
    return false;
  }
  /**
   * 获取标题（默认实现，子类应重写）
   */
  async fetchTitle(url, env) {
    return { title: null, author: "" };
  }
};

// src/platforms/wechat.ts
var WeChatPlatform = class extends BasePlatform {
  static {
    __name(this, "WeChatPlatform");
  }
  getName() {
    return "wechat";
  }
  /**
   * 检查是否为微信文章链接
   */
  canHandle(url) {
    const hostname = this.extractHostname(url);
    return hostname.includes("mp.weixin.qq.com") || hostname.includes("weixin.qq.com");
  }
  /**
   * 获取微信文章标题
   */
  async fetchTitle(url, env) {
    const cache = env.KV;
    if (cache) {
      const cached = await cache.get(url, "json");
      if (cached) {
        return { title: cached.title, author: cached.author || "", cached: true };
      }
    }
    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      };
      const response = await fetch(url, {
        headers,
        redirect: "follow",
        cf: { cacheTtl: 3600, cacheEverything: true }
      });
      if (!response.ok) {
        return { title: null, author: "" };
      }
      const finalUrl = response.url;
      const html = await response.text();
      const title = this.extractTitle(html, finalUrl);
      if (cache && title) {
        await cache.put(url, JSON.stringify({ title, author: "" }), {
          expirationTtl: 3600
          // 1 hour
        });
      }
      return { title, author: "" };
    } catch (error) {
      console.error(`[WeChat] Fetch failed: ${error.message}`);
      return { title: null, author: "" };
    }
  }
  /**
   * 从 HTML 中提取标题
   */
  extractTitle(html, url) {
    if (!html) return null;
    let title = null;
    const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) {
      title = ogMatch[1].trim();
    }
    if (!title) {
      const msgMatch = html.match(/msg_title\s*=\s*(?:window\.title\s*=\s*)?["']([^"']+)["']/);
      if (msgMatch && msgMatch[1]) {
        title = decodeURIComponent(msgMatch[1]).trim();
      }
    }
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }
    }
    if (!title) {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        let clean = h1Match[1].replace(/<[^>]+>/g, "").trim();
        if (clean) {
          title = decodeURIComponent(clean);
        }
      }
    }
    if (title && url.includes("xiaohongshu.com")) {
      title = title.replace(/\s*-\s*小红书$/, "");
    }
    return title;
  }
  /**
   * 提取主机名
   */
  extractHostname(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  /**
   * 解码 HTML 实体
   */
  decodeEntities(text) {
    if (!text) return "";
    return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  }
};

// src/platforms/twitter.ts
var TwitterPlatform = class extends BasePlatform {
  static {
    __name(this, "TwitterPlatform");
  }
  getName() {
    return "twitter";
  }
  /**
   * 检查是否为 Twitter/X 链接
   */
  canHandle(url) {
    const hostname = this.extractHostname(url);
    return hostname.includes("twitter.com") || hostname.includes("x.com");
  }
  /**
   * 获取 Tweet 信息
   */
  async fetchTitle(url, env) {
    const tweetId = this.extractTweetId(url);
    if (!tweetId) {
      return { title: null, author: "" };
    }
    const cache = env.KV;
    if (cache) {
      const cached = await cache.get(`tweet:${tweetId}`, "json");
      if (cached) {
        const titleStr = `"${cached.title}" #${cached.author}`;
        return { title: titleStr, author: cached.username || "", cached: true };
      }
    }
    return await this.fetchWithJina(url, env);
  }
  async fetchWithJina(url, env) {
    try {
      const cleanUrl = url.replace(/^https?:\/\//, "");
      const apiUrl = `https://r.jina.ai/http://${cleanUrl}`;
      const headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      };
      if (env.JINA_API_KEY) {
        headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;
      }
      const response = await fetch(apiUrl, {
        headers,
        signal: AbortSignal.timeout(15e3)
      });
      if (!response.ok) {
        return { title: null, author: "", method: "twitter_jina", error: `Jina HTTP ${response.status}` };
      }
      const content = await response.text();
      const { title, author } = this.parseJinaTweet(content);
      if (!title && !author) {
        return { title: null, author: "", method: "twitter_jina", error: "Jina parse failed" };
      }
      return { title: title || null, author: author || "", method: "twitter_jina" };
    } catch (error) {
      if (error.name === "AbortError" || error.name === "TimeoutError") {
        return { title: null, author: "", method: "twitter_jina", error: "Jina timeout" };
      }
      return { title: null, author: "", method: "twitter_jina", error: "Jina request failed" };
    }
  }
  parseJinaTweet(content) {
    const titleLine = content.split("\n").find((line) => line.startsWith("Title:")) || "";
    if (titleLine) {
      const raw = titleLine.replace(/^Title:\s*/, "").trim();
      const match = raw.match(/^(.*?)\s+on X:\s+"([\s\S]*?)"\s*\/\s*X$/);
      if (match) {
        return { author: match[1].trim(), title: match[2].trim() };
      }
      const fallback = raw.replace(/\s*\/\s*X$/i, "").trim();
      if (fallback) {
        return { author: null, title: fallback };
      }
    }
    const paragraphMatch = content.match(/\nMarkdown Content:\n([\s\S]+)/);
    if (paragraphMatch?.[1]) {
      const firstLine = paragraphMatch[1].split("\n").find((line) => line.trim().length > 0);
      if (firstLine) {
        return { author: null, title: firstLine.trim() };
      }
    }
    return { title: null, author: null };
  }
  /**
   * 从 URL 提取 Tweet ID
   */
  extractTweetId(url) {
    const patterns = [
      /twitter\.com\/\w+\/status\/(\d+)/,
      /x\.com\/\w+\/status\/(\d+)/,
      /mobile\.twitter\.com\/\w+\/status\/(\d+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  /**
   * 提取主机名
   */
  extractHostname(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return "";
    }
  }
};

// src/config/constants.ts
var CONFIG = {
  CACHE_TTL: 300,
  // 5分钟缓存
  TIMEOUT: 15e3
  // 15秒超时
};
var USER_AGENTS = {
  GENERIC: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.google.com/bot.html)",
  XIAOHOUGSHU: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  WECHAT: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  DOUYIN: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// src/utils/html.ts
function decodeEntities(text) {
  if (!text) return "";
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}
__name(decodeEntities, "decodeEntities");
function extractTitleFromHtml(html) {
  if (!html) return null;
  let title = null;
  const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogMatch && ogMatch[1]) {
    title = decodeEntities(ogMatch[1]).trim();
  }
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = decodeEntities(titleMatch[1]).trim();
    }
  }
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      let clean = h1Match[1].replace(/<[^>]+>/g, "").trim();
      if (clean) {
        title = decodeEntities(clean);
      }
    }
  }
  return title;
}
__name(extractTitleFromHtml, "extractTitleFromHtml");

// src/platforms/xiaohongshu.ts
var XiaohongshuPlatform = class extends BasePlatform {
  static {
    __name(this, "XiaohongshuPlatform");
  }
  getName() {
    return "xiaohongshu";
  }
  /**
   * 检查是否为小红书链接
   */
  canHandle(url) {
    const hostname = this.extractHostname(url);
    return hostname.includes("xiaohongshu.com") || hostname.includes("xhslink.com");
  }
  /**
   * 获取小红书标题
   */
  async fetchTitle(url, env) {
    const noteId = await this.extractNoteId(url);
    if (!noteId) {
      return { title: null, author: "" };
    }
    const cache = env.KV;
    if (cache) {
      const cached = await cache.get(`xhs:${noteId}`, "json");
      if (cached && cached.title && !this.isInvalidTitle(cached.title)) {
        let author = cached.author || "";
        if (author.includes(".create")) author = "";
        const titleStr = author ? `${cached.title} #${author}` : `${cached.title}`;
        return { title: titleStr, author, cached: true };
      }
    }
    const methods = [
      () => this.fetchWithMetaTags(url),
      // Try Meta Tags + JSON first (More reliable for official page)
      () => this.fetchWithJinaReader(url, env)
    ];
    for (const method of methods) {
      try {
        const result = await method();
        if (result?.error) {
          continue;
        }
        if (result?.title && !this.isInvalidTitle(result.title)) {
          const title = result.title.replace(/\s*-\s*小红书$/, "").trim();
          let author = result.author || "";
          if (author.includes(".create")) {
            author = "";
          }
          if (cache && title) {
            await cache.put(`xhs:${noteId}`, JSON.stringify({ title, author }), {
              expirationTtl: 3600
            });
          }
          const titleStr = author ? `${title} #${author}` : `${title}`;
          return { title: titleStr, author };
        }
      } catch (error) {
        console.error(`[\u5C0F\u7EA2\u4E66] Fetch failed: ${error.message}`);
        continue;
      }
    }
    return { title: null, author: "" };
  }
  /**
   * 从 URL 提取笔记 ID
   */
  async extractNoteId(url) {
    try {
      const urlObj = new URL(url);
      const exploreMatch = urlObj.pathname.match(/\/explore\/([a-f0-9]+)/i);
      if (exploreMatch) {
        return exploreMatch[1];
      }
      if (urlObj.hostname.includes("xhslink.com")) {
        const pathId = urlObj.pathname.replace(/^\//, "").replace(/\//g, "");
        return pathId || null;
      }
      return urlObj.pathname.split("/").pop() || null;
    } catch {
      return null;
    }
  }
  async fetchWithMetaTags(url) {
    try {
      const desktopUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const response = await fetch(url, {
        headers: {
          "User-Agent": desktopUA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        signal: AbortSignal.timeout(CONFIG.TIMEOUT),
        redirect: "follow"
      });
      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }
      const html = await response.text();
      let title = "";
      let author = "";
      let description = "";
      const stateResult = this.extractFromInitialState(html);
      if (stateResult) {
        if (stateResult.title && !this.isInvalidTitle(stateResult.title)) title = stateResult.title;
        if (stateResult.author) author = stateResult.author;
        if (stateResult.desc) description = stateResult.desc;
      }
      if (this.isInvalidTitle(title)) {
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
        const metaTitle = titleMatch ? decodeEntities(titleMatch[1]) : "";
        const metaDesc = descMatch ? decodeEntities(descMatch[1]) : "";
        if (!this.isInvalidTitle(metaTitle)) {
          title = metaTitle;
        } else if (metaDesc) {
          title = metaDesc.length > 50 ? `${metaDesc.substring(0, 50)}...` : metaDesc;
        }
        if (!description) description = metaDesc;
      }
      if (this.isInvalidTitle(title)) {
        const tagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (tagMatch) {
          const tagTitle = decodeEntities(tagMatch[1]).replace(/\s*-\s*小红书$/, "").trim();
          if (!this.isInvalidTitle(tagTitle)) {
            title = tagTitle;
          }
        }
      }
      if (!author) {
        const authMatch = html.match(/"nickname":"([^"]+)"/);
        if (authMatch) author = authMatch[1];
      }
      if (this.isInvalidTitle(title)) {
        return { error: "Generic title" };
      }
      return {
        title: title.trim(),
        author,
        description,
        method: "meta_tags"
      };
    } catch (error) {
      if (error.name === "AbortError" || error.name === "TimeoutError") {
        return { error: "Timeout" };
      }
      return { error: error.message };
    }
  }
  /**
   * Validates and extracts JSON from window.__INITIAL_STATE__
   */
  extractFromInitialState(html) {
    const marker = "window.__INITIAL_STATE__=";
    const startIndex = html.indexOf(marker);
    if (startIndex === -1) return null;
    let cursor = startIndex + marker.length;
    while (cursor < html.length && /\s/.test(html[cursor])) cursor++;
    if (html[cursor] !== "{") return null;
    let balance = 0;
    let inString = false;
    let escaped = false;
    let startJson = cursor;
    for (let i = cursor; i < html.length; i++) {
      const char = html[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{") balance++;
        else if (char === "}") {
          balance--;
          if (balance === 0) {
            const jsonStr = html.substring(startJson, i + 1);
            try {
              const cleanJson = jsonStr.replace(/undefined/g, "null");
              const data = JSON.parse(cleanJson);
              let title, author, desc;
              if (data?.note?.note) {
                title = data.note.note.title;
                desc = data.note.note.desc;
                author = data.note.note.user?.nickname || data.note.note.user?.name;
              } else if (data?.note?.firstNote) {
                title = data.note.firstNote.title;
                desc = data.note.firstNote.desc;
                author = data.note.firstNote.user?.nickname || data.note.firstNote.user?.name;
              } else if (data?.note?.noteDetailMap) {
                const vals = Object.values(data.note.noteDetailMap);
                if (vals.length > 0) {
                  const note = vals[0].note || vals[0];
                  title = note.title;
                  desc = note.desc;
                  author = note.user?.nickname || note.user?.name;
                }
              }
              return { title, author, desc };
            } catch (e) {
              return null;
            }
          }
        }
      }
    }
    return null;
  }
  /**
   * 使用 Jina Reader API 获取信息
   */
  async fetchWithJinaReader(url, env) {
    try {
      const cleanUrl = url.replace(/^https?:\/\//, "");
      const apiUrl = `https://r.jina.ai/http://${cleanUrl}`;
      const headers = { "User-Agent": USER_AGENTS.XIAOHOUGSHU };
      if (env.JINA_API_KEY) {
        headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;
      }
      const response = await fetch(apiUrl, {
        headers,
        signal: AbortSignal.timeout(CONFIG.TIMEOUT)
      });
      if (response.status === 429) {
        return { error: "Rate limit exceeded" };
      }
      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }
      const content = await response.text();
      const result = this.parseXiaohongshuContent(content);
      return { ...result, method: "jina_reader" };
    } catch (error) {
      if (error.name === "AbortError" || error.name === "TimeoutError") {
        return { error: "Timeout" };
      }
      return { error: error.message };
    }
  }
  parseXiaohongshuContent(content) {
    const result = {
      title: "",
      author: "",
      description: ""
    };
    let cleanContent = content.replace(/={20,}/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const titleMatch1 = cleanContent.match(/^Title:\s*([^\n]+?)\s*-\s*小红书/m);
    if (titleMatch1) {
      result.title = titleMatch1[1].trim();
    }
    if (!result.title) {
      const titleMatch2 = cleanContent.match(/^([^\n]+?)\s*-\s*小红书/m);
      if (titleMatch2) {
        result.title = titleMatch2[1].trim();
      }
    }
    if (!result.title) {
      const titleMatch3 = cleanContent.match(/^Title:\s*([^\n]+)/m);
      if (titleMatch3) {
        result.title = titleMatch3[1].trim();
      }
    }
    if (!result.title) {
      const firstLine = cleanContent.split("\n")[0];
      if (firstLine && !firstLine.includes("Title:") && firstLine.length < 100) {
        result.title = firstLine.trim();
      }
    }
    const authorPatterns = [
      /by\s+([a-zA-Z0-9_\u4e00-\u9fa5]+)/i,
      /发布者[:：]\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)/,
      /作者[:：]\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)/
    ];
    for (const pattern of authorPatterns) {
      const match = cleanContent.match(pattern);
      if (match && match[1] && !result.author) {
        if (!match[1].includes(".create")) {
          result.author = match[1];
          break;
        }
      }
    }
    return result;
  }
  extractHostname(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  isInvalidTitle(title) {
    if (!title) return true;
    const lower = title.toLowerCase().trim();
    if (lower === "" || lower === "vlog" || lower === "\u5C0F\u7EA2\u4E66") return true;
    const stripped = lower.replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
    if (stripped === "vlog") return true;
    return false;
  }
};

// src/platforms/douyin.ts
var DouyinPlatform = class extends BasePlatform {
  static {
    __name(this, "DouyinPlatform");
  }
  getName() {
    return "douyin";
  }
  /**
   * 检查是否为抖音链接
   */
  canHandle(url) {
    const hostname = this.extractHostname(url);
    return hostname.includes("douyin.com") || hostname.includes("v.douyin.com");
  }
  /**
   * 获取抖音视频标题
   */
  async fetchTitle(url, env) {
    const resolvedUrl = await this.resolveShortLink(url);
    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
      };
      const response = await fetch(resolvedUrl, {
        headers,
        redirect: "follow",
        cf: { cacheTtl: 3600, cacheEverything: true }
      });
      if (!response.ok) {
        return { title: null, author: "", method: "douyin_html", error: `HTTP ${response.status}` };
      }
      const html = await response.text();
      const { title: rawTitle, author } = this.extractMetadataFromHtml(html);
      let title = rawTitle;
      if (title) {
        title = author ? `${title} #${author}` : `${title}`;
      }
      return { title, author, method: "douyin_html" };
    } catch (error) {
      console.error(`[Douyin] Fetch failed: ${error.message}`);
      return { title: null, author: "", method: "douyin_html", error: "Request failed" };
    }
  }
  async resolveShortLink(url) {
    if (!url.includes("v.douyin.com")) {
      return url;
    }
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
        }
      });
      const location = response.headers.get("location");
      if (location) {
        return location;
      }
      return response.url || url;
    } catch {
      return url;
    }
  }
  /**
   * 从 HTML 中提取标题
   */
  extractMetadataFromHtml(html) {
    if (!html) return { title: null, author: "" };
    const routerIndex = html.indexOf("window._ROUTER_DATA");
    if (routerIndex !== -1) {
      try {
        const braceStart = html.indexOf("{", routerIndex);
        const scriptEnd = html.indexOf("<\/script>", braceStart);
        if (braceStart !== -1 && scriptEnd !== -1) {
          let jsonStr = html.slice(braceStart, scriptEnd).trim();
          if (jsonStr.endsWith(";")) {
            jsonStr = jsonStr.slice(0, -1);
          }
          jsonStr = jsonStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
          const data = JSON.parse(jsonStr);
          const item = data?.loaderData?.["video_(id)/page"]?.videoInfoRes?.item_list?.[0];
          if (item) {
            let title = item.desc || "";
            const author = item.author?.nickname || "";
            title = title.replace(/#\S+\s*/g, " ").trim();
            if (title.length > 40) {
              title = title.substring(0, 40) + "...";
            }
            if (!title) {
              const fallback2 = this.fallbackTitleExtraction(html);
              return { title: fallback2, author };
            }
            return { title: title || null, author };
          }
        }
      } catch {
      }
    }
    const fallback = this.fallbackTitleExtraction(html);
    return { title: fallback, author: "" };
  }
  /**
   * 备用标题提取方法
   */
  fallbackTitleExtraction(html) {
    if (!html) return null;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
    return null;
  }
  /**
   * 提取主机名
   */
  extractHostname(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return "";
    }
  }
};

// src/platforms/feishu.ts
var FeishuPlatform = class extends BasePlatform {
  static {
    __name(this, "FeishuPlatform");
  }
  getName() {
    return "feishu";
  }
  canHandle(url) {
    const hostname = this.extractHostname(url);
    return hostname.includes("feishu.cn") || hostname.includes("feishu.com");
  }
  async fetchTitle(url, env) {
    try {
      const cleanUrl = url.replace(/^https?:\/\//, "");
      const apiUrl = `https://r.jina.ai/http://${cleanUrl}`;
      const headers = {
        "User-Agent": USER_AGENTS.GENERIC
      };
      if (env.JINA_API_KEY) {
        headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;
      }
      const response = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(15e3) });
      if (!response.ok) {
        return { title: null, author: "" };
      }
      const content = await response.text();
      const author = this.extractAuthor(content);
      const title = this.extractTitle(content);
      if (title) {
        return { title, author };
      }
    } catch {
    }
    return await this.fetchFromHtml(url);
  }
  async fetchFromHtml(url) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENTS.GENERIC },
        redirect: "follow",
        signal: AbortSignal.timeout(15e3)
      });
      if (!response.ok) {
        return { title: null, author: "" };
      }
      const html = await response.text();
      const title = extractTitleFromHtml(html);
      if (!title) {
        return { title: null, author: "" };
      }
      return { title, author: "" };
    } catch {
      return { title: null, author: "" };
    }
  }
  extractAuthor(content) {
    const authorPatterns = [
      /创建者[：:]\s*([^\n\r]+)/i,
      /作者[：:]\s*([^\n\r]+)/i,
      /by\s+([^\n\r]+)/i,
      /文档所有者[：:]\s*([^\n\r]+)/i
    ];
    for (const pattern of authorPatterns) {
      const match = content.match(pattern);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
    }
    return "";
  }
  extractTitle(content) {
    const firstLine = content.split("\n")[0]?.trim();
    if (!firstLine) {
      return null;
    }
    let title = firstLine.replace(/^Title:\s*/i, "").trim();
    title = title.replace(/\s*-\s*Feishu\s*Docs$/i, "").trim();
    if (!title) {
      return null;
    }
    if (title.length > 100) {
      return title.substring(0, 100);
    }
    return title;
  }
  extractHostname(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return "";
    }
  }
};

// src/platforms/generic.ts
var GenericPlatform = class extends BasePlatform {
  static {
    __name(this, "GenericPlatform");
  }
  getName() {
    return "generic";
  }
  /**
   * 兜底处理器可以处理所有 URL
   */
  canHandle(url) {
    return true;
  }
  /**
   * 通用标题抓取
   */
  async fetchTitle(url, env) {
    const cache = env.KV;
    if (cache) {
      const cached = await cache.get(url, "json");
      if (cached) {
        return { title: cached.title, author: cached.author || "", cached: true };
      }
    }
    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.google.com/bot.html)"
      };
      const response = await fetch(url, {
        headers,
        redirect: "follow",
        cf: { cacheTtl: 3600, cacheEverything: true }
      });
      if (!response.ok) {
        return { title: null, author: "" };
      }
      const finalUrl = response.url;
      const html = await response.text();
      const title = this.extractTitle(html);
      if (cache && title) {
        await cache.put(url, JSON.stringify({ title, author: "" }), {
          expirationTtl: 3600
        });
      }
      return { title, author: "" };
    } catch (error) {
      console.error(`[Generic] Fetch failed: ${error.message}`);
      return { title: null, author: "" };
    }
  }
  /**
   * 从 HTML 中提取标题（多种方法）
   */
  extractTitle(html) {
    if (!html) return null;
    let title = null;
    const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) {
      title = ogMatch[1].trim();
    }
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }
    }
    if (!title) {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match && h1Match[1]) {
        let clean = h1Match[1].replace(/<[^>]+>/g, "").trim();
        if (clean) {
          title = clean;
        }
      }
    }
    return title;
  }
};

// src/utils/cors.ts
function createCorsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(createCorsHeaders, "createCorsHeaders");
function createOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
__name(createOptionsResponse, "createOptionsResponse");

// src/classification-rules.ts
var CLASSIFICATION_RULES = `
# Content Classification Rules (SOP) / \u5185\u5BB9\u5206\u7C7B\u89C4\u5219

You are the intelligent classification assistant for a digital workbench. Please classify the user's input into one of the following 5 categories based on these rules.
\u4F60\u662F\u6570\u5B57\u5DE5\u4F5C\u53F0\u7684\u667A\u80FD\u5206\u7C7B\u52A9\u624B\u3002\u8BF7\u6839\u636E\u4EE5\u4E0B\u89C4\u5219\u5C06\u7528\u6237\u8F93\u5165\u5206\u7C7B\u4E3A 5 \u4E2A\u7C7B\u522B\u4E4B\u4E00\u3002

---

## Classification Targets / \u5206\u7C7B\u76EE\u6807

Classify content into one of these 5 categories:
\u8BF7\u5C06\u5185\u5BB9\u5F52\u7C7B\u4E3A\u4EE5\u4E0B 5 \u7C7B\u4E4B\u4E00\uFF1A

| Category | Label | Description (EN) | Description (CN) |
|----------|-------|------------------|------------------|
| \u{1F4A1} Ideas | ideas | Flashes of inspiration, creative ideas, fleeting thoughts. | \u7075\u611F\u95EA\u73B0\u3001\u521B\u610F\u60F3\u6CD5\u3001\u7A0D\u7EB5\u5373\u901D\u7684\u5FF5\u5934\u3002 |
| \u{1F4BC} Work | work | Work-related tasks, projects, technical content, meetings. | \u5DE5\u4F5C\u4EFB\u52A1\u3001\u9879\u76EE\u3001\u6280\u672F\u5185\u5BB9\u3001\u4F1A\u8BAE\u3002 |
| \u{1F3E0} Personal | personal | Personal affairs, family, shopping, health, life admin. | \u4E2A\u4EBA\u4E8B\u52A1\u3001\u5BB6\u5EAD\u3001\u8D2D\u7269\u3001\u5065\u5EB7\u3001\u751F\u6D3B\u7410\u4E8B\u3002 |
| \u{1F517} External | external | Articles to read, videos to watch, external resources (Read Later). | \u5F85\u8BFB\u6587\u7AE0\u3001\u5F85\u770B\u89C6\u9891\u3001\u5916\u90E8\u8D44\u6E90\uFF08\u7A0D\u540E\u9605\u8BFB\uFF09\u3002 |
| \u{1F4DD} Others | others | Content that clearly doesn't fit the above categories. | \u663E\u7136\u4E0D\u5C5E\u4E8E\u4E0A\u8FF0\u7C7B\u522B\u7684\u5185\u5BB9\u3002 |

---

## \u{1F6AB} Noise Filtering (Critical) / \u566A\u97F3\u8FC7\u6EE4\uFF08\u5173\u952E\uFF09

User input may contain redundant text from App sharing (Noise), which does NOT represent user intent. Ignore:
\u7528\u6237\u8F93\u5165\u53EF\u80FD\u5305\u542B\u6765\u81EA App \u5206\u4EAB\u7684\u5197\u4F59\u6587\u672C\uFF08\u566A\u97F3\uFF09\uFF0C\u8FD9\u4E0D\u4EE3\u8868\u7528\u6237\u610F\u56FE\u3002\u8BF7\u5FFD\u7565\uFF1A

- "Copy and open [Platform]..." / "\u590D\u5236\u6253\u5F00..."
- "Top comments..." / "\u770B\u770B\u8BC4\u8BBA..."
- "@Username's video..." / "@\u67D0\u67D0\u7684\u89C6\u9891..."
- "#Tags"
- The link itself (http...) / \u94FE\u63A5\u672C\u8EAB
- The original title embedded in the share text / \u5206\u4EAB\u6587\u672C\u4E2D\u5D4C\u5165\u7684\u539F\u6807\u9898

**Core Principle: Distinguish between "description of content" and "user's added note". Only user's added note determines the intent.**
**\u6838\u5FC3\u539F\u5219\uFF1A\u533A\u5206\u201C\u5185\u5BB9\u63CF\u8FF0\u201D\u548C\u201C\u7528\u6237\u9644\u52A0\u7B14\u8BB0\u201D\u3002\u53EA\u6709\u7528\u6237\u7684\u9644\u52A0\u7B14\u8BB0\u51B3\u5B9A\u771F\u5B9E\u610F\u56FE\u3002**

---

## Classification Priority / \u5206\u7C7B\u4F18\u5148\u7EA7

**Check in this order / \u6309\u6B64\u987A\u5E8F\u68C0\u67E5:**

### 1. Link Recognition (URL) / \u94FE\u63A5\u8BC6\u522B

**Core Rule: All pure links (without user note, or only with platform noise) are classified as \`external\` (External).**
**\u6838\u5FC3\u89C4\u5219\uFF1A\u6240\u6709\u7EAF\u94FE\u63A5\uFF08\u65E0\u7528\u6237\u7B14\u8BB0\uFF0C\u6216\u4EC5\u542B\u5E73\u53F0\u566A\u97F3\uFF09\u5747\u5F52\u7C7B\u4E3A \`external\`\u3002**

Only if the user adds a specific note expressing personal intent does it change category:
\u53EA\u6709\u5F53\u7528\u6237\u6DFB\u52A0\u4E86\u8868\u8FBE\u4E2A\u4EBA\u610F\u56FE\u7684\u5177\u4F53\u7B14\u8BB0\u65F6\uFF0C\u624D\u6539\u53D8\u5206\u7C7B\uFF1A

| Scenario | Category | Reasoning |
|----------|----------|-----------|
| Pure Link | external | Default Read Later / \u9ED8\u8BA4\u7A0D\u540E\u8BFB |
| Link + "Copy to open..." | external | Noise ignored / \u5FFD\u7565\u566A\u97F3 |
| Link + "Review later" | work | User work intent / \u5DE5\u4F5C\u610F\u56FE |
| Link + "Buy this" | personal | User shopping intent / \u8D2D\u7269\u610F\u56FE |
| Link + "Great idea" | ideas | User inspiration / \u7075\u611F\u610F\u56FE |

### 1.5 Specific Platform Rules / \u7279\u5B9A\u5E73\u53F0\u89C4\u5219

1.  **Xiaohongshu (Red) / TikTok / Bilibili / YouTube** -> **external**
    - These are content consumption platforms. Default to external.
    - \u5C0F\u7EA2\u4E66\u3001\u6296\u97F3\u3001B\u7AD9\u3001YouTube -> **external**
    - Even if the title contains "idea" or "tutorial", it is external (resource) unless the user says "I want to do this".

### 2. Keyword Matching / \u5173\u952E\u8BCD\u5339\u914D

**\u{1F4A1} ideas (Inspiration/\u7075\u611F):**
- Triggers: idea, thought, maybe, what if, inspiration, concept, brainstorm, "suddenly thought of", "could try".
- \u89E6\u53D1\u8BCD\uFF1A\u60F3\u6CD5\u3001\u7075\u611F\u3001\u5FF5\u5934\u3001\u6216\u8BB8\u3001\u5982\u679C\u3001\u5934\u8111\u98CE\u66B4\u3001\u201C\u7A81\u7136\u60F3\u5230\u201D\u3001\u201C\u8BD5\u4E00\u4E0B\u201D\u3002
- Context: Creative thinking, non-actionable abstract thoughts.

**\u{1F4BC} work (Work/\u5DE5\u4F5C):**
- Triggers: project, meeting, deadline, bug, client, report, code, API, deploy, install, config, follow up, review, test, release.
- \u89E6\u53D1\u8BCD\uFF1A\u9879\u76EE\u3001\u4F1A\u8BAE\u3001\u622A\u6B62\u3001\u5BA2\u6237\u3001\u62A5\u544A\u3001\u4EE3\u7801\u3001\u90E8\u7F72\u3001\u5B89\u88C5\u3001\u914D\u7F6E\u3001\u8DDF\u8FDB\u3001\u8BC4\u5BA1\u3001\u6D4B\u8BD5\u3001\u53D1\u5E03\u3002
- Context: Professional tasks, execution-oriented.

**\u{1F3E0} personal (Personal/\u4E2A\u4EBA):**
- Triggers: buy, shop, health, gym, home, dinner, travel, appointment, doctor, bill, visa, move, kids, family.
- \u89E6\u53D1\u8BCD\uFF1A\u4E70\u3001\u901B\u3001\u5065\u5EB7\u3001\u5065\u8EAB\u3001\u5BB6\u3001\u665A\u9910\u3001\u65C5\u884C\u3001\u9884\u7EA6\u3001\u533B\u751F\u3001\u8D26\u5355\u3001\u7B7E\u8BC1\u3001\u642C\u5BB6\u3001\u5B69\u5B50\u3001\u5BB6\u5EAD\u3002
- Context: Private life, household, consumption, well-being.

**\u{1F517} external (External/\u5916\u90E8):**
- Triggers: read, watch, check out, article, video, tutorial, learn, study.
- \u89E6\u53D1\u8BCD\uFF1A\u8BFB\u3001\u770B\u3001\u6587\u7AE0\u3001\u89C6\u9891\u3001\u6559\u7A0B\u3001\u5B66\u4E60\u3001\u7814\u7A76\u3001\u94FE\u63A5\u3002
- Context: Passive consumption of information.

**\u{1F4DD} others (Others/\u5176\u4ED6):**
- Fallback for ambiguous content or undefined short phrases.
- \u5BF9\u6A21\u7CCA\u5185\u5BB9\u6216\u672A\u5B9A\u4E49\u77ED\u8BED\u7684\u515C\u5E95\u3002

### 3. Sentence Pattern / \u53E5\u5F0F\u5206\u6790

| Pattern (EN/CN) | Category |
|-----------------|----------|
| "I want to..." / "\u6211\u60F3..." / "What if..." | ideas |
| "Need to..." / "\u9700\u8981..." / "Remember to..." / "\u8BB0\u5F97..." | work / personal |
| "Check this..." / "\u770B\u8FD9\u4E2A..." / "Recommended..." / "\u63A8\u8350..." | external |
| Specific time (Mon 3pm) / \u5177\u4F53\u65F6\u95F4 | work (default) or personal |

---

## \u{1F9D0} Self-Correction Protocol / \u81EA\u67E5\u534F\u8BAE

**Before outputting, you MUST perform this strict check:**
**\u5728\u8F93\u51FA\u524D\uFF0C\u5FC5\u987B\u6267\u884C\u6B64\u4E25\u683C\u68C0\u67E5\uFF1A**

1.  **Initial Judgment**: Conclusion based on keywords. (\u521D\u5224)
2.  **Critique**: (\u6279\u5224)
    - "Is this category accurate?" (\u5206\u7C7B\u51C6\u786E\u5417\uFF1F)
    - "Did I mistake a personal task (e.g., dentist) for 'Others'?" (\u662F\u5426\u628A\u4E2A\u4EBA\u4EFB\u52A1\u9519\u5224\u4E3A\u5176\u4ED6\uFF1F)
    - "Is this just a link I should mark as 'External'?" (\u8FD9\u662F\u5426\u53EA\u662F\u4E2A\u94FE\u63A5\u5E94\u5F52\u4E3A\u5916\u90E8\uFF1F)
3.  **Final Verdict**: Correct if necessary. (\u6700\u7EC8\u88C1\u51B3)

---

## Output Format / \u8F93\u51FA\u683C\u5F0F

**Return VALID JSON:**

{
    "reasoning": "Your thought process and critique / \u601D\u8003\u8FC7\u7A0B\u4E0E\u6279\u5224",
    "category": "final_category"
}

*** Category Values MUST be one of: "ideas", "work", "personal", "external", "others" ***
*** category \u503C\u5FC5\u987B\u662F\u4EE5\u4E0B\u4E4B\u4E00\uFF1A"ideas", "work", "personal", "external", "others" ***

---

## Examples / \u793A\u4F8B

| Input | Category |
|-------|----------|
| "Suddenly thought AI could write reports" / "\u7A81\u7136\u60F3\u5230AI\u53EF\u4EE5\u5199\u62A5\u544A" | ideas |
| "Project idea - New workbench design" / "\u9879\u76EE\u70B9\u5B50 - \u65B0\u5DE5\u4F5C\u53F0\u8BBE\u8BA1" | ideas |
| "Finish PRD review by Friday" / "\u5468\u4E94\u524D\u5B8C\u6210PRD\u8BC4\u5BA1" | work |
| "Follow up with Nicole on invoice" / "\u8DDF\u8FDB\u4E00\u4E0B\u53D1\u7968\u7684\u4E8B" | work |
| "https://mp.weixin.qq.com/s/xxx" | external |
| "https://github.com/user/repo" | external |
| "https://github.com/user/repo install later" / "...\u7A0D\u540E\u5B89\u88C5" | work |
| "Watch this Bilibili tutorial" / "\u770B\u8FD9\u4E2AB\u7AD9\u6559\u7A0B" | external |
| "Remember to buy toothbrush" / "\u8BB0\u5F97\u4E70\u7259\u5237" | personal |
| "Book dentist appointment" / "\u9884\u7EA6\u770B\u7259" | personal |
`;

// src/index.ts
var PLATFORMS = [
  new WeChatPlatform(),
  new TwitterPlatform(),
  new XiaohongshuPlatform(),
  new DouyinPlatform(),
  new FeishuPlatform(),
  new GenericPlatform()
  // 兜底
];
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get("url");
    const resolveOnly = url.searchParams.get("resolve") === "1";
    const debug = url.searchParams.get("debug") === "1";
    if (request.method === "OPTIONS") {
      return createOptionsResponse();
    }
    if (request.method === "POST" && !targetUrl) {
      return handleClassify(request, env);
    }
    if (!targetUrl) {
      return new Response(JSON.stringify({ title: null, author: null }), {
        status: 400,
        headers: createCorsHeaders()
      });
    }
    if (request.method === "GET" && resolveOnly) {
      const userAgent = targetUrl.includes("xhslink.com") ? USER_AGENTS.XIAOHOUGSHU : USER_AGENTS.GENERIC;
      try {
        const response = await fetch(targetUrl, {
          headers: { "User-Agent": userAgent },
          redirect: "follow"
        });
        const resolvedUrl = response.url || targetUrl;
        return new Response(JSON.stringify({ resolvedUrl }), {
          headers: createCorsHeaders()
        });
      } catch (error) {
        return new Response(JSON.stringify({ resolvedUrl: targetUrl, error: error.message }), {
          headers: createCorsHeaders()
        });
      }
    }
    for (const platform of PLATFORMS) {
      if (platform.canHandle(targetUrl)) {
        const result = await platform.fetchTitle(targetUrl, env);
        const response = debug ? JSON.stringify(result) : result.title ? JSON.stringify(result) : JSON.stringify({ title: null, author: null });
        return new Response(response, {
          headers: {
            ...createCorsHeaders(),
            "Cache-Control": result.cached ? "public, max-age=3600" : "no-cache"
          }
        });
      }
    }
    return new Response(JSON.stringify({ error: "No platform handler found" }), {
      status: 500,
      headers: createCorsHeaders()
    });
  }
};
async function handleClassify(request, env) {
  try {
    const body = await request.json();
    const { content, metadata } = body;
    if (!content) {
      return new Response(JSON.stringify({ error: "Missing content" }), {
        status: 400,
        headers: createCorsHeaders()
      });
    }
    const glmApiKey = env.GLM_API_KEY;
    if (!glmApiKey) {
      return new Response(JSON.stringify({ error: "GLM API key not configured" }), {
        status: 500,
        headers: createCorsHeaders()
      });
    }
    const prompt = `
${CLASSIFICATION_RULES}

---

Input Content / \u7528\u6237\u8F93\u5165\u539F\u6587:
"""
${content}
"""

Metadata / \u5143\u6570\u636E:
${JSON.stringify(metadata || {}, null, 2)}

\u8BF7\u4E25\u683C\u9075\u5B88 JSON \u683C\u5F0F\u8FD4\u56DE\uFF0C\u786E\u4FDD\u6240\u6709\u5B57\u7B26\u4E32\u5185\u7684\u53CC\u5F15\u53F7\u90FD\u7ECF\u8FC7\u8F6C\u4E49\uFF08\\"\uFF09\uFF0C\u4E0D\u8981\u5305\u542B Markdown \u6807\u8BB0\uFF1A
{
  "category": "category_key"
}
`;
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${glmApiKey}`
      },
      body: JSON.stringify({
        model: "glm-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2e3
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: "GLM API Failed", details: errorText }), {
        status: 500,
        headers: createCorsHeaders()
      });
    }
    const data = await response.json();
    let rawContent = data.choices?.[0]?.message?.content?.trim();
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      rawContent = jsonMatch[0];
    }
    rawContent = rawContent.replace(/^```json\s*/, "").replace(/^```\s*/, "");
    let result;
    try {
      result = JSON.parse(rawContent);
    } catch (e) {
      result = {
        category: "others",
        reasoning: "JSON Parse Error, Raw: " + rawContent
      };
    }
    const allowedCategories = /* @__PURE__ */ new Set(["ideas", "work", "personal", "external", "others"]);
    if (!result || typeof result.category !== "string" || !allowedCategories.has(result.category)) {
      result = {
        category: metadata?.isLink ? "external" : "others",
        reasoning: "Invalid category from model, fallback applied"
      };
    }
    return new Response(JSON.stringify(result), {
      headers: createCorsHeaders()
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Error", details: error.message }), {
      status: 500,
      headers: createCorsHeaders()
    });
  }
}
__name(handleClassify, "handleClassify");

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-FHF7yu/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-FHF7yu/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
