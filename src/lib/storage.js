// All persistence lives in chrome.storage.local — on the user's machine only.
// Nothing here is ever synced or sent to any doubleii server (there is none).

const HISTORY_KEY = "history";
const HISTORY_LIMIT = 200;

export const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

export async function getSettings() {
  const d = await chrome.storage.local.get([
    "provider",
    "model",
    "anthropicKey",
    "openaiKey",
  ]);
  return {
    provider: d.provider || "anthropic",
    model: d.model || "",
    anthropicKey: d.anthropicKey || "",
    openaiKey: d.openaiKey || "",
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
