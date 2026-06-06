import { getHistory, clearHistory } from "../lib/storage.js";

const list = document.getElementById("list");
const empty = document.getElementById("empty");

function fmtDate(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

function card(entry) {
  const head = el("div", { className: "card-head" });
  head.append(el("blockquote", { className: "quote", textContent: entry.selectedText }));

  const meta = el("div", { className: "card-meta" });
  if (entry.url) {
    const link = el("a", {
      className: "link",
      href: entry.fragmentUrl || entry.url,
      target: "_blank",
      rel: "noreferrer",
      textContent: "Open article →",
    });
    meta.append(link);
  }
  meta.append(
    el("span", {
      className: "muted small",
      textContent: [entry.title, fmtDate(entry.ts), entry.model || entry.provider, entry.language]
        .filter(Boolean)
        .join(" · "),
    })
  );

  return el(
    "div",
    { className: "card history-card" },
    head,
    el("p", { className: "answer", textContent: entry.explanation }),
    meta
  );
}

async function render() {
  const history = await getHistory();
  list.replaceChildren();
  if (!history.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  for (const entry of history) list.append(card(entry));
}

document.getElementById("clear").addEventListener("click", async () => {
  await clearHistory();
  render();
});

render();
