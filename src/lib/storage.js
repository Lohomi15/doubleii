// All persistence lives in chrome.storage.local — on the user's machine only.
// Nothing here is ever synced or sent to any doubleii server (there is none).

const HISTORY_KEY = "history";
const HISTORY_LIMIT = 200;

export const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

// USD per 1 million tokens (input / output).
// These are approximate list prices — check provider dashboards for current rates.
const PRICING = {
  "claude-haiku-4-5-20251001": { input: 0.80,  output: 4.00  },
  "claude-sonnet-4-6":         { input: 3.00,  output: 15.00 },
  "claude-opus-4-8":           { input: 15.00, output: 75.00 },
  "gpt-4o-mini":               { input: 0.15,  output: 0.60  },
  "gpt-4o":                    { input: 2.50,  output: 10.00 },
};

export function computeCost(model, inputTokens, outputTokens) {
  const p = PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function getSettings() {
  const d = await chrome.storage.local.get([
    "provider",
    "model",
    "anthropicKey",
    "openaiKey",
    "language",
    "customPrompt",
  ]);
  return {
    provider: d.provider || "anthropic",
    model: d.model || "",
    anthropicKey: d.anthropicKey || "",
    openaiKey: d.openaiKey || "",
    language: d.language || "English",
    customPrompt: d.customPrompt || "",
  };
}

export async function saveSettings(partial) {
  await chrome.storage.local.set(partial);
}

export async function activeKey(settings) {
  const s = settings || (await getSettings());
  return s.provider === "anthropic" ? s.anthropicKey : s.openaiKey;
}

export async function getHistory() {
  const d = await chrome.storage.local.get(HISTORY_KEY);
  return d[HISTORY_KEY] || [];
}

export async function addHistory(entry) {
  const history = await getHistory();
  history.unshift(entry);
  await chrome.storage.local.set({
    [HISTORY_KEY]: history.slice(0, HISTORY_LIMIT),
  });
}

export async function clearHistory() {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
}
