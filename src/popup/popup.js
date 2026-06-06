import { getSettings, activeKey } from "../lib/storage.js";

async function render() {
  const s = await getSettings();
  const hasKey = !!(await activeKey(s));
  const state = document.getElementById("state");
  if (hasKey) {
    state.innerHTML = `Ready · provider: <b>${s.provider}</b>`;
  } else {
    state.innerHTML = `⚠️ No <b>${s.provider}</b> key set — open Settings to add one.`;
  }
}

document.getElementById("settings").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById("history").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("src/history/history.html") });
});

render();
