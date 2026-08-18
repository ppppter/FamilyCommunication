/*
 * 阿里云函数计算（FC）中转示例
 * 作用：保护 DeepSeek API Key，让前端通过函数计算间接调用大模型
 * 触发器类型：HTTP 触发器
 * 运行时：Node.js 18 / 16
 *
 * 环境变量配置：
 *   DEEPSEEK_API_KEY = sk-xxxxxxxx
 *   DEEPSEEK_API_URL = https://api.deepseek.com/chat/completions
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';

// 阿里云 FC HTTP 触发器入口
exports.handler = async (event, context) => {
  // 解析请求体
  let body = {};
  try {
    // event 可能是字符串，也可能是 Buffer
    const raw = typeof event === 'string' ? event : event.toString();
    const parsed = JSON.parse(raw);
    body = parsed.body ? JSON.parse(parsed.body) : parsed;
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
