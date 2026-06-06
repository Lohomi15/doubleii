// doubleii service worker — the extension's private backend, running inside the
// user's browser. Holds the API key, talks to the provider, saves history.
// Content scripts never see the key; they only send selection + context here.

import { getSettings, addHistory } from "../lib/storage.js";
import { explain } from "../lib/providers.js";
import { composeSystemPrompt } from "../lib/prompt.js";

const MENU_ID = "doubleii-explain";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Explain with doubleii",
    contexts: ["selection"],
  });
});

// Right-click → "Explain with doubleii": ask the content script to act on the
// current selection.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "doubleii:trigger" }).catch(() => {});
  }
});

// Keyboard shortcut (Alt+B by default; rebindable at chrome://extensions/shortcuts).
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "explain-selection" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "doubleii:trigger" }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // The content script sends selection + context here; we call the provider and
  // return the explanation (and persist it to local history).
  if (msg?.type === "doubleii:explain") {
    handleExplain(msg.payload)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: String(e?.message || e), code: e?.code || "GENERIC" }));
    return true; // keep the message channel open for the async response
  }
  // Let the bubble open the settings page (e.g. when no key is set).
  if (msg?.type === "doubleii:open-options") {
    chrome.runtime.openOptionsPage();
    return false;
  }
  return false;
});

async function handleExplain(payload) {
  const settings = await getSettings();
  const key = settings.provider === "anthropic" ? settings.anthropicKey : settings.openaiKey;
  if (!key) {
    return {
      error: `No ${settings.provider} API key set yet.`,
      code: "NO_KEY",
    };
  }

  const system = composeSystemPrompt(settings.customPrompt, settings.language);

  const explanation = await explain({
    provider: settings.provider,
    model: settings.model,
    keys: { anthropicKey: settings.anthropicKey, openaiKey: settings.openaiKey },
    system,
    selectedText: payload.selectedText,
    context: payload.context,
    title: payload.title,
  });

  await addHistory({
    id: payload.id,
    selectedText: payload.selectedText,
    explanation,
    url: payload.url,
    fragmentUrl: payload.fragmentUrl,
    title: payload.title,
    provider: settings.provider,
    model: settings.model || "",
    language: settings.language,
    ts: payload.ts,
  });

  return { explanation };
}
