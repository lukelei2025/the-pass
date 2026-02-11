const https = require('https');
const url = 'https://mp.weixin.qq.com/s/g_iUFqd0HvFTUO1Ub-_ymQ';

const USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Googlebot/2.1 (+http://www.google.com/bot.html)',
];

function decodeEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function extractTitle(html) {
    const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogMatch && ogMatch[1]) return decodeEntities(ogMatch[1].trim());

    const msgMatch = html.match(/var\s+msg_title\s*=\s*["']([^"']+)["']/);
    if (msgMatch && msgMatch[1]) return decodeEntities(msgMatch[1].trim());

    // New format support
    const msgMatch2 = html.match(/msg_title\s*=\s*(?:window\.title\s*=\s*)?["']([^"']+)["']/);
    if (msgMatch2 && msgMatch2[1]) return decodeEntities(msgMatch2[1].trim());


    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1].trim()) return decodeEntities(titleMatch[1].trim());

    return null;
}

function fetchUrl(targetUrl, ua) {
    return new Promise((resolve, reject) => {
        const req = https.get(targetUrl, {
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        });
        req.on('error', reject);
    });
}

async function run() {
    console.log(`Testing URL: ${url}`);
    for (const ua of USER_AGENTS) {
        console.log(`\nUsing UA: ${ua}`);
        try {
            const { statusCode, data } = await fetchUrl(url, ua);
            console.log(`Status Code: ${statusCode}`);
            if (statusCode === 200) {
                const title = extractTitle(data);
                console.log(`Extracted Title: ${title}`);
                if (title) break;
            } else {
                console.log('Response not OK');
            }
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
}

run();
