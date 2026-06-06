import { getSettings, saveSettings } from "../lib/storage.js";
import { LANGUAGES, DEFAULT_SYSTEM_PROMPT } from "../lib/prompt.js";

const $ = (sel) => document.querySelector(sel);

function syncProviderFields(provider) {
  document.querySelectorAll("[data-provider]").forEach((el) => {
    el.style.display = el.dataset.provider === provider ? "" : "none";
  });
}

function selectedProvider() {
  return document.querySelector("input[name=provider]:checked")?.value || "anthropic";
}

function fillLanguages(selected) {
  const sel = $("#language");
  sel.replaceChildren(
    ...LANGUAGES.map((lang) => {
      const opt = document.createElement("option");
      opt.value = lang;
      opt.textContent = lang;
      if (lang === selected) opt.selected = true;
      return opt;
    })
  );
}

async function load() {
  const s = await getSettings();
  const radio = document.querySelector(`input[name=provider][value="${s.provider}"]`);
  if (radio) radio.checked = true;
  $("#anthropicKey").value = s.anthropicKey;
  $("#openaiKey").value = s.openaiKey;
  $("#model").value = s.model;
  fillLanguages(s.language);
  // Empty box → the default prompt shows as a faded placeholder.
  $("#prompt").placeholder = DEFAULT_SYSTEM_PROMPT;
  $("#prompt").value = s.customPrompt;
  syncProviderFields(s.provider);
}

document.addEventListener("change", (e) => {
  if (e.target.name === "provider") syncProviderFields(selectedProvider());
});

$("#reset").addEventListener("click", () => {
  $("#prompt").value = "";
  $("#prompt").focus();
});

$("#save").addEventListener("click", async () => {
  await saveSettings({
    provider: selectedProvider(),
    model: $("#model").value.trim(),
    anthropicKey: $("#anthropicKey").value.trim(),
    openaiKey: $("#openaiKey").value.trim(),
    language: $("#language").value,
    customPrompt: $("#prompt").value.trim(),
  });
  const status = $("#status");
  status.textContent = "Saved ✓";
  setTimeout(() => (status.textContent = ""), 1800);
});

load();
