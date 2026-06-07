import { getSettings, saveSettings } from "../lib/storage.js";
import { LANGUAGES, DEFAULT_SYSTEM_PROMPT } from "../lib/prompt.js";

const $ = (sel) => document.querySelector(sel);

// ---- model definitions --------------------------------------------------

const MODELS = {
  anthropic: [
    {
      value: "claude-haiku-4-5-20251001",
      name: "Claude Haiku 4.5",
      hint: "Fast · best for most articles",
    },
    {
      value: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      hint: "Balanced · good for dense or technical text",
    },
    {
      value: "claude-opus-4-8",
      name: "Claude Opus 4.8",
      hint: "Most capable · for highly complex content",
    },
  ],
  openai: [
    {
      value: "gpt-4o-mini",
      name: "GPT-4o mini",
      hint: "Fast · best for most articles",
    },
    {
      value: "gpt-4o",
      name: "GPT-4o",
      hint: "More capable · for complex or technical content",
    },
  ],
};

// ---- model dropdown state -----------------------------------------------

let selectedModelValue = "";

function modelList(provider) {
  return MODELS[provider] || MODELS.anthropic;
}

function buildModelDropdown(provider, savedValue) {
  const list = modelList(provider);
  const active = savedValue && list.find((m) => m.value === savedValue)
    ? savedValue
    : list[0].value;

  const dropdown = $("#modelDropdown");
  dropdown.replaceChildren(
    ...list.map((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "model-opt" + (m.value === active ? " active" : "");
      btn.dataset.value = m.value;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", m.value === active ? "true" : "false");
      btn.innerHTML =
        `<span class="model-opt-name">${m.name}</span>` +
        `<span class="model-opt-hint">${m.hint}</span>`;
      btn.addEventListener("click", () => pickModel(m));
      return btn;
    })
  );

  selectedModelValue = active;
  const activeModel = list.find((m) => m.value === active);
  setTrigger(activeModel);
}

function setTrigger(model) {
  $("#modelTriggerName").textContent = model.name;
  $("#modelTriggerHint").textContent = model.hint;
}

function pickModel(model) {
  selectedModelValue = model.value;
  document.querySelectorAll(".model-opt").forEach((btn) => {
    const on = btn.dataset.value === model.value;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  setTrigger(model);
  closeDropdown();
}

function openDropdown() {
  $("#modelSelect").classList.add("open");
  $("#modelTrigger").setAttribute("aria-expanded", "true");
}

function closeDropdown() {
  $("#modelSelect").classList.remove("open");
  $("#modelTrigger").setAttribute("aria-expanded", "false");
}

$("#modelTrigger").addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = $("#modelSelect").classList.contains("open");
  if (isOpen) closeDropdown(); else openDropdown();
});

document.addEventListener("click", () => closeDropdown());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDropdown();
});

// ---- provider / language ------------------------------------------------

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

// ---- load / save --------------------------------------------------------

async function load() {
  const s = await getSettings();
  const radio = document.querySelector(`input[name=provider][value="${s.provider}"]`);
  if (radio) radio.checked = true;
  $("#anthropicKey").value = s.anthropicKey;
  $("#openaiKey").value = s.openaiKey;
  fillLanguages(s.language);
  $("#prompt").placeholder = DEFAULT_SYSTEM_PROMPT;
  $("#prompt").value = s.customPrompt;
  syncProviderFields(s.provider);
  buildModelDropdown(s.provider, s.model);
}

document.addEventListener("change", (e) => {
  if (e.target.name === "provider") {
    const provider = selectedProvider();
    syncProviderFields(provider);
    buildModelDropdown(provider, ""); // reset to default for new provider
  }
});

$("#reset").addEventListener("click", () => {
  $("#prompt").value = "";
  $("#prompt").focus();
});

$("#save").addEventListener("click", async () => {
  await saveSettings({
    provider: selectedProvider(),
    model: selectedModelValue,
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
