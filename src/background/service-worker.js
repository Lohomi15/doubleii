// doubleii service worker — the extension's private backend, running inside the
// user's browser. Holds the API key, talks to the provider, saves history.
// Content scripts never see the key; they only send selection + context here.

import { getSettings, addHistory } from "../lib/storage.js";
import { explain } from "../lib/providers.js";

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

// The content script sends selection + context here; we call the provider and
// return the explanation (and persist it to local history).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "doubleii:explain") {
    handleExplain(msg.payload)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: String(e?.message || e) }));
    return true; // keep the message channel open for the async response
  }
  return false;
});

async function handleExplain(payload) {
  const settings = await getSettings();
  const key = settings.provider === "anthropic" ? settings.anthropicKey : settings.openaiKey;
  if (!key) {
    return {
      error: `No ${settings.provider} API key set. Click the doubleii icon → Settings to add one.`,
    };
  }

  const explanation = await explain({
    provider: settings.provider,
    model: settings.model,
    keys: { anthropicKey: settings.anthropicKey, openaiKey: settings.openaiKey },
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
    ts: payload.ts,
  });

  return { explanation };
}
