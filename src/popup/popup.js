import { getSettings, activeKey } from "../lib/storage.js";

async function render() {
  const s = await getSettings();
  const hasKey = !!(await activeKey(s));
  const state = document.getElementById("state");
  state.textContent = "";

  if (hasKey) {
    state.append("Ready · provider: ");
    const b = document.createElement("b");
    b.textContent = s.provider;
    state.append(b);
  } else {
    state.append("⚠️ No ");
    const b = document.createElement("b");
    b.textContent = s.provider;
    state.append(b, " key set — open Settings to add one.");
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
