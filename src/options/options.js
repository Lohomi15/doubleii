import { getSettings, saveSettings, getHistory } from "../lib/storage.js";
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
      const nm = document.createElement("span"); nm.className = "model-opt-name"; nm.textContent = m.name;
      const ht = document.createElement("span"); ht.className = "model-opt-hint"; ht.textContent = m.hint;
      btn.append(nm, ht);
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
loadUsage();

// ---- usage stats --------------------------------------------------------

function mondayOf(ts) {
  const d = new Date(ts);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function weekLabel(monTs) {
  const mon = new Date(monTs);
  const sun = new Date(monTs + 6 * 86400000);
  const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (mon.getMonth() === sun.getMonth()) {
    return `${mo[mon.getMonth()]} ${mon.getDate()}–${sun.getDate()}`;
  }
  return `${mo[mon.getMonth()]} ${mon.getDate()} – ${mo[sun.getMonth()]} ${sun.getDate()}`;
}

function fmtTokens(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k tokens`;
  return `${n} tokens`;
}

function fmtCost(c) {
  if (c === 0) return "$0";
  if (c < 0.0001) return "<$0.0001";
  if (c < 0.01) return `$${c.toFixed(4)}`;
  return `$${c.toFixed(3)}`;
}

function shortModelName(model) {
  const MAP = {
    "claude-haiku-4-5-20251001": "Haiku 4.5",
    "claude-sonnet-4-6":         "Sonnet 4.6",
    "claude-opus-4-8":           "Opus 4.8",
    "gpt-4o-mini":               "GPT-4o mini",
    "gpt-4o":                    "GPT-4o",
  };
  return MAP[model] || model;
}

async function loadUsage() {
  const history = await getHistory();
  const card = document.getElementById("usageCard");
  const chip = document.getElementById("usageChip");
  const chipText = document.getElementById("usageChipText");
  const breakdown = document.getElementById("usageBreakdown");

  // Only entries with token data
  const tracked = history.filter((e) => e.inputTokens || e.outputTokens || e.cost);
  if (!tracked.length) return; // hide card if no data yet
  card.style.display = "";

  // Last-7-days summary
  const cutoff = Date.now() - 7 * 86400000;
  const recent = tracked.filter((e) => e.ts >= cutoff);
  const recentTokens = recent.reduce((s, e) => s + (e.inputTokens || 0) + (e.outputTokens || 0), 0);
  const recentCost   = recent.reduce((s, e) => s + (e.cost || 0), 0);
  chipText.textContent = recent.length
    ? `Last 7 days · ${fmtTokens(recentTokens)} · ${fmtCost(recentCost)}`
    : "Last 7 days · no usage yet";

  // Chip toggle
  chip.addEventListener("click", () => {
    const open = chip.classList.toggle("open");
    breakdown.classList.toggle("open", open);
    if (open && !breakdown.hasChildNodes()) renderBreakdown(tracked, breakdown);
  });
}

function renderBreakdown(entries, container) {
  // Group by week (Monday key)
  const weeks = new Map();
  for (const e of entries) {
    const wk = mondayOf(e.ts);
    if (!weeks.has(wk)) weeks.set(wk, new Map());
    const byModel = weeks.get(wk);
    const model = e.model || "unknown";
    if (!byModel.has(model)) byModel.set(model, { tokens: 0, cost: 0, count: 0 });
    const row = byModel.get(model);
    row.tokens += (e.inputTokens || 0) + (e.outputTokens || 0);
    row.cost   += e.cost || 0;
    row.count  += 1;
  }

  // Render newest week first
  const sorted = [...weeks.entries()].sort((a, b) => b[0] - a[0]);

  for (const [monTs, byModel] of sorted) {
    const weekTotal = [...byModel.values()].reduce(
      (s, r) => ({ tokens: s.tokens + r.tokens, cost: s.cost + r.cost }), { tokens: 0, cost: 0 }
    );

    const section = document.createElement("div");
    section.className = "usage-week";

    const hdr = document.createElement("div"); hdr.className = "usage-week-header";
    const lbl = document.createElement("span"); lbl.className = "usage-week-label";
    lbl.textContent = `Week of ${weekLabel(monTs)}`;
    const tot = document.createElement("span"); tot.className = "usage-week-total";
    tot.textContent = `${fmtTokens(weekTotal.tokens)} · ${fmtCost(weekTotal.cost)}`;
    hdr.append(lbl, tot);
    section.appendChild(hdr);

    for (const [model, row] of [...byModel.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
      const r = document.createElement("div"); r.className = "usage-row";
      const nm = document.createElement("span"); nm.className = "usage-row-model";
      nm.textContent = shortModelName(model);
      const st = document.createElement("span"); st.className = "usage-row-stats";
      st.textContent = `${fmtTokens(row.tokens)} · ${fmtCost(row.cost)}`;
      r.append(nm, st);
      section.appendChild(r);
    }

    container.appendChild(section);
  }
}
