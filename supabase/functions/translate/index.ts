/*
 * Supabase Edge Function：AI 润色中转
 * 作用：保护 DeepSeek API Key，让前端通过 Supabase 间接调用大模型
 *
 * 部署命令（需安装 Supabase CLI）：
 *   supabase functions deploy translate
 *
 * 环境变量配置（Supabase Dashboard → Project Settings → Edge Functions）：
 *   DEEPSEEK_API_KEY = sk-xxxxxxxx
 *   DEEPSEEK_API_URL = https://api.deepseek.com/chat/completions
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const DEEPSEEK_API_URL = Deno.env.get("DEEPSEEK_API_URL") ||
  "https://api.deepseek.com/chat/completions";

serve(async (req: Request) => {
  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  let body: { text?: string; systemPrompt?: string } = {};
  try {
    body = await req.json();
  } catch (_e) {
    return jsonResponse(400, { error: "请求体格式错误" });
  }

  const { text, systemPrompt } = body;
  if (!text) {
    return jsonResponse(400, { error: "缺少 text 参数" });
  }
  if (!DEEPSEEK_API_KEY) {
    return jsonResponse(500, { error: "服务器未配置 DEEPSEEK_API_KEY" });
  }

  try {
    const result = await callDeepSeek(text, systemPrompt);
    return jsonResponse(200, result);
  } catch (err) {
    console.error("DeepSeek 调用失败：", err);
    const message = err instanceof Error ? err.message : "大模型服务异常";
    return jsonResponse(502, { error: message });
  }
});

async function callDeepSeek(text: string, systemPrompt?: string) {
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: text });

  const res = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek 返回 ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

function jsonResponse(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, Authorization, Content-Type",
  };
}
