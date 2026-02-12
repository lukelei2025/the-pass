
const fs = require('fs');
const html = fs.readFileSync('wechat_debug_4.html', 'utf8');

// Title Extraction
const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);

console.log('Title Match:', titleMatch ? titleMatch[1] : 'null');

// Author Extraction (Current Logic)
function extractAuthorInfo(html) {
    const result = { account: null, author: null };

    // 1. JsDecode
    const jsDecodeMatch = html.match(/(?:nickname|nick_name)\s*:\s*JsDecode\(['"]([^'"]+)['"]\)/i);
    console.log('JsDecode Match:', jsDecodeMatch ? jsDecodeMatch[1] : 'null');

    // 2. htmlDecode
    const accountMatchHtmlDecode = html.match(/var\s+nickname\s*=\s*htmlDecode\(['"]([^'"]+)['"]\)/i);
    console.log('HtmlDecode Match:', accountMatchHtmlDecode ? accountMatchHtmlDecode[1] : 'null');

    // 3. JS Object
    const jsObjMatch1 = html.match(/(?:nickname|nick_name)\s*:\s*['"]((?!data-miniprogram-nickname)[^'"]+)['"]/i);
    // Note: The global flag 'g' isn't used here, so it finds the first match.
    console.log('JS Object Match:', jsObjMatch1 ? jsObjMatch1[1] : 'null');

    // 4. Var
    const accountMatch1 = html.match(/var\s+nickname\s*=\s*"([^"]+)"/i);
    console.log('Var Match:', accountMatch1 ? accountMatch1[1] : 'null');

    // 5. DOM
    const domMatch = html.match(/<strong[^>]*class="[^"]*profile_nickname[^"]*"[^>]*>(.*?)<\/strong>/i) ||
        html.match(/class="[^"]*wx_follow_nickname[^"]*"[^>]*>(.*?)<\//i) ||
        html.match(/id="js_name">\s*([^<]+?)\s*<\/a>/i);
    console.log('DOM Match:', domMatch ? domMatch[1] : 'null');

    return result;
}

extractAuthorInfo(html);
