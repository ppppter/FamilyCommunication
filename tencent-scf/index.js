/*
 * 腾讯云云函数（SCF）中转示例
 * 作用：保护 DeepSeek API Key，让前端通过腾讯云函数间接调用大模型
 * 触发器类型：API 网关触发器
 * 运行时：Node.js 16 / 18
 *
 * 环境变量配置：
 *   DEEPSEEK_API_KEY = sk-xxxxxxxx
 *   DEEPSEEK_API_URL = https://api.deepseek.com/chat/completions
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';

// 腾讯云 SCF 入口（API 网关触发器）
exports.main_handler = async (event, context) => {
  // 解析请求体
  let body = {};
  try {
    const rawBody = event.body || event;
    const decoded = event.isBase64Encoded
      ? Buffer.from(rawBody, 'base64').toString('utf8')
      : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));
    body = JSON.parse(decoded);
  } catch (e) {
    return response(400, { error: '请求体格式错误' });
  }

  const { text, systemPrompt } = body;
  if (!text) {
    return response(400, { error: '缺少 text 参数' });
  }
  if (!DEEPSEEK_API_KEY) {
    return response(500, { error: '服务器未配置 DEEPSEEK_API_KEY' });
  }

  try {
    const result = await callDeepSeek(text, systemPrompt);
    return response(200, result);
  } catch (err) {
    console.error('DeepSeek 调用失败：', err);
    return response(502, { error: err.message || '大模型服务异常' });
  }
};

async function callDeepSeek(text, systemPrompt) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: text });

  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek 返回 ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function response(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(data)
  };
}
