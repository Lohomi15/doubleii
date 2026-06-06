// doubleii content script — runs on every page. Plain script (no imports/modules).
//
// Responsibilities:
//   1. Detect a text selection and show a small "explain" affordance.
//   2. Extract the surrounding article context (article body, or a window
//      around the selection as a fallback).
//   3. Render a floating bubble (Shadow DOM, isolated from the page's CSS) with
//      a shimmer, then the explanation returned by the service worker.
//
// The API key never lives here — we only send selection + context to the
// service worker, which makes the actual provider call.

(() => {
  if (window.__doubleiiLoaded) return;
  window.__doubleiiLoaded = true;

  const HOST_ID = "doubleii-host";
  const MAX_CONTEXT_CHARS = 6000;
  const MIN_SELECTION_CHARS = 2;

  let host = null; // shadow host element on the page
  let shadow = null;
  let iconBtn = null;
  let bubble = null;
  let currentSelection = null; // { text, rect }

  // ---- selection handling -------------------------------------------------

  document.addEventListener("mouseup", onPointerUp, true);
  document.addEventListener("keyup", (e) => {
    // Allow keyboard selections (shift+arrows) to surface the icon too.
    if (e.shiftKey) onPointerUp(e);
  });
  document.addEventListener("mousedown", (e) => {
    if (insideOurUI(e.target)) return;
    hideIcon();
    hideBubble();
  });
  // Triggered by Alt+B (command) or the right-click menu, via the service worker.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "doubleii:trigger") {
      const info = readSelection();
      if (info) startExplain(info);
    }
  });

  function onPointerUp(e) {
    if (insideOurUI(e.target)) return;
    // Defer so the browser finalizes the selection first.
    setTimeout(() => {
      const info = readSelection();
      if (info) showIcon(info);
      else hideIcon();
    }, 10);
  }

  function readSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const text = sel.toString().trim();
    if (text.length < MIN_SELECTION_CHARS) return null;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return { text, rect, range };
  }

  function insideOurUI(node) {
    return !!(node && node.closest && node.closest(`#${HOST_ID}`));
  }

  // ---- context extraction -------------------------------------------------

  function extractContext(range, selectedText) {
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const container =
      (node &&
        node.closest(
          "article, main, [role='main'], .post, .article, .entry-content, #content"
        )) ||
      document.body;

    let text = (container.innerText || "").replace(/\n{3,}/g, "\n\n").trim();

    if (text.length > MAX_CONTEXT_CHARS) {
      // Window the context around the selection so the model sees what's near it.
      const idx = text.indexOf(selectedText);
      if (idx >= 0) {
        const start = Math.max(0, idx - Math.floor(MAX_CONTEXT_CHARS / 2));
        text = text.slice(start, start + MAX_CONTEXT_CHARS);
      } else {
        text = text.slice(0, MAX_CONTEXT_CHARS);
      }
    }
    return text;
  }

  function buildFragmentUrl(selectedText) {
    // Chrome text-fragment link: reopens the page scrolled to and highlighting
    // the exact line. Cap length so the URL stays valid.
    const snippet = selectedText.replace(/\s+/g, " ").trim().slice(0, 150);
    try {
      return `${location.origin}${location.pathname}${location.search}#:~:text=${encodeURIComponent(
        snippet
      )}`;
    } catch {
      return location.href;
    }
  }

  // ---- shadow host + styles ----------------------------------------------

  function ensureHost() {
    if (host) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    Object.assign(host.style, {
      all: "initial",
      position: "fixed",
      zIndex: "2147483647",
      top: "0",
      left: "0",
    });
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLES;
    shadow.appendChild(style);
    document.documentElement.appendChild(host);
  }

  function placeAt(el, rect) {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Render off-screen briefly to measure, then clamp into the viewport.
    el.style.left = "-9999px";
    el.style.top = "-9999px";
    requestAnimationFrame(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      let left = Math.min(Math.max(margin, rect.left), vw - w - margin);
      let top = rect.bottom + margin;
      if (top + h > vh - margin) top = Math.max(margin, rect.top - h - margin);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    });
  }

  // ---- icon ---------------------------------------------------------------

  function showIcon(info) {
    ensureHost();
    hideIcon();
    currentSelection = info;
    iconBtn = document.createElement("button");
    iconBtn.className = "dii-icon";
    iconBtn.title = "Explain with doubleii (Alt+B)";
    iconBtn.innerHTML = `${EYES_SVG}<span>Explain</span>`;
    iconBtn.addEventListener("mousedown", (e) => e.preventDefault());
    iconBtn.addEventListener("click", () => startExplain(currentSelection));
    shadow.appendChild(iconBtn);
    placeAt(iconBtn, info.rect);
  }

  function hideIcon() {
    if (iconBtn) {
      iconBtn.remove();
      iconBtn = null;
    }
  }

  // ---- bubble -------------------------------------------------------------

  function startExplain(info) {
    if (!info) return;
    hideIcon();
    showBubble(info.rect);
    setBubbleLoading();

    const payload = {
      id: `${info.rect.top | 0}-${performance.now() | 0}-${(Math.random() * 1e6) | 0}`,
      selectedText: info.text,
      context: extractContext(info.range, info.text),
      title: document.title || "",
      url: location.href,
      fragmentUrl: buildFragmentUrl(info.text),
      ts: Date.now(),
    };

    chrome.runtime
      .sendMessage({ type: "doubleii:explain", payload })
      .then((res) => {
        if (!bubble) return;
        if (res?.error) setBubbleError(res.error);
        else setBubbleText(res?.explanation || "No explanation returned.");
      })
      .catch((e) => {
        if (bubble) setBubbleError(String(e?.message || e));
      });
  }

  function showBubble(rect) {
    ensureHost();
    hideBubble();
    bubble = document.createElement("div");
    bubble.className = "dii-bubble";
    bubble.innerHTML = `
      <div class="dii-head">
        <span class="dii-brand">${EYES_SVG}<b>doubleii</b></span>
        <button class="dii-close" title="Close" aria-label="Close">×</button>
      </div>
      <div class="dii-body"></div>`;
    bubble.querySelector(".dii-close").addEventListener("click", hideBubble);
    shadow.appendChild(bubble);
    placeAt(bubble, rect);
  }

  function bodyEl() {
    return bubble && bubble.querySelector(".dii-body");
  }

  function setBubbleLoading() {
    const body = bodyEl();
    if (!body) return;
    body.innerHTML = `
      <div class="dii-shimmer"></div>
      <div class="dii-shimmer"></div>
      <div class="dii-shimmer short"></div>`;
  }

  function setBubbleText(text) {
    const body = bodyEl();
    if (!body) return;
    body.className = "dii-body";
    body.textContent = text;
  }

  function setBubbleError(text) {
    const body = bodyEl();
    if (!body) return;
    body.className = "dii-body dii-error";
    body.textContent = text;
  }

  function hideBubble() {
    if (bubble) {
      bubble.remove();
      bubble = null;
    }
  }

  // ---- assets -------------------------------------------------------------

  const EYES_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="8.5" cy="12" r="2.4" fill="currentColor"/>
    <circle cx="15.5" cy="12" r="2.4" fill="currentColor"/></svg>`;

  const STYLES = `
    :host { all: initial; }
    .dii-icon {
      position: fixed; display: inline-flex; align-items: center; gap: 6px;
      font: 600 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #fff; background: #4f46e5; border: 0; border-radius: 8px;
      padding: 7px 10px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.22);
    }
    .dii-icon:hover { background: #4338ca; }
    .dii-icon svg { color: #fff; }
    .dii-bubble {
      position: fixed; width: 320px; max-width: 90vw;
      background: #1f2330; color: #f3f4f6; border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,.35); overflow: hidden;
      font: 400 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .dii-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 12px; background: rgba(255,255,255,.04);
    }
    .dii-brand { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #c7c9d1; }
    .dii-brand b { color: #fff; font-weight: 700; letter-spacing: .2px; }
    .dii-brand svg { color: #8b8ff5; }
    .dii-close {
      background: transparent; border: 0; color: #9aa0ab; font-size: 18px;
      line-height: 1; cursor: pointer; padding: 0 2px;
    }
    .dii-close:hover { color: #fff; }
    .dii-body { padding: 12px 14px; white-space: pre-wrap; }
    .dii-error { color: #fca5a5; }
    .dii-shimmer {
      height: 11px; border-radius: 6px; margin: 7px 0;
      background: linear-gradient(90deg, #2a2f3d 25%, #3a4150 37%, #2a2f3d 63%);
      background-size: 400% 100%; animation: dii-shine 1.3s ease-in-out infinite;
    }
    .dii-shimmer.short { width: 55%; }
    @keyframes dii-shine { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }`;
})();
