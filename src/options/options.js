import { getSettings, saveSettings } from "../lib/storage.js";

const $ = (sel) => document.querySelector(sel);

function syncProviderFields(provider) {
  document.querySelectorAll("[data-provider]").forEach((el) => {
    el.style.display = el.dataset.provider === provider ? "" : "none";
  });
}

async function load() {
  const s = await getSettings();
  const radio = document.querySelector(`input[name=provider][value="${s.provider}"]`);
  if (radio) radio.checked = true;
  $("#anthropicKey").value = s.anthropicKey;
  $("#openaiKey").value = s.openaiKey;
  $("#model").value = s.model;
  syncProviderFields(s.provider);
}

function selectedProvider() {
  return document.querySelector("input[name=provider]:checked")?.value || "anthropic";
}

document.addEventListener("change", (e) => {
  if (e.target.name === "provider") syncProviderFields(selectedProvider());
});

$("#save").addEventListener("click", async () => {
  await saveSettings({
    provider: selectedProvider(),
    model: $("#model").value.trim(),
    anthropicKey: $("#anthropicKey").value.trim(),
    openaiKey: $("#openaiKey").value.trim(),
  });
  const status = $("#status");
  status.textContent = "Saved ✓";
  setTimeout(() => (status.textContent = ""), 1800);
});

load();
