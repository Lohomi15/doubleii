// Provider calls. These run inside the extension's service worker, which can
// fetch cross-origin (via host_permissions) without CORS issues, and keeps the
// API key out of the page/content-script context for safety.
//
// The user's text goes directly from their browser to the provider they chose,
// using their own key. doubleii has no server in the middle.

import { DEFAULT_MODELS } from "./storage.js";
import { buildUserPrompt } from "./prompt.js";

const MAX_TOKENS = 400;

export async function explain({ provider, model, keys, system, selectedText, context, title }) {
  const user = buildUserPrompt({ selectedText, context, title });
  if (provider === "anthropic") {
    return callAnthropic({ model, key: keys.anthropicKey, system, user });
  }
  if (provider === "openai") {
    return callOpenAI({ model, key: keys.openaiKey, system, user });
  }
  throw providerError("GENERIC", `Unknown provider: ${provider}`);
}

async function callAnthropic({ model, key, system, user }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      // Required to call the Anthropic API directly from a browser context.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.anthropic,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw await toError("Anthropic", res);
  const data = await res.json();
  const explanation = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return {
    explanation,
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

async function callOpenAI({ model, key, system, user }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODELS.openai,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw await toError("OpenAI", res);
  const data = await res.json();
  return {
    explanation: (data.choices?.[0]?.message?.content || "").trim(),
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

// Build an Error carrying a machine-readable `code` so the bubble can show the
// right recovery action (open settings vs. retry).
function providerError(code, message) {
  return Object.assign(new Error(message), { code });
}

async function toError(label, res) {
  // Log the raw body internally only — never expose it to page context or
  // bubble text (it may contain fragments of the API key in auth-failure responses).
  try { console.error(`[doubleii] ${label} ${res.status}:`, (await res.clone().text()).slice(0, 200)); } catch {}
  if (res.status === 401 || res.status === 403) {
    return providerError("AUTH", `Your ${label} API key was rejected. Check it in Settings.`);
  }
  if (res.status === 429) {
    return providerError("RATE", `${label} rate limit or out of credits — check your billing.`);
  }
  return providerError("GENERIC", `Something went wrong with ${label} (HTTP ${res.status}).`);
}
