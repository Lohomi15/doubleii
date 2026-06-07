// doubleii content script — runs on every page. Plain script (no imports/modules).
//
// Responsibilities:
//   1. Detect a text selection and show a small "explain" affordance.
//   2. Extract the surrounding article context (article body, or a window
//      around the selection as a fallback).
//   3. Render a floating bubble (Shadow DOM, isolated from the page's CSS) with
//      a "thinking" shimmer, then the explanation returned by the service worker.
//
// The API key never lives here — we only send selection + context to the
// service worker, which makes the actual provider call.

(() => {
  if (window.__doubleiiLoaded) return;
  window.__doubleiiLoaded = true;

  const HOST_ID = "doubleii-host";
  const MAX_CONTEXT_CHARS = 6000;
  const MIN_SELECTION_CHARS = 2;

  const THINKING_MESSAGES = [
    "Reading the context…",
    "Thinking it through…",
    "Putting it in plain words…",
    "Thinking a little longer…",
  ];

  let host = null; // shadow host element on the page
  let shadow = null;
  let iconBtn = null;
  let bubble = null;
  let currentSelection = null; // selection backing the icon
  let lastInfo = null; // last selection we explained (for retry)
  let thinkTimer = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // ---- selection handling -------------------------------------------------

  document.addEventListener("mouseup", onPointerUp, true);
  document.addEventListener("keyup", (e) => {
    if (e.shiftKey) onPointerUp(e); // keyboard selections (shift+arrows)
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
    style.textContent = fontFaceCSS() + STYLES;
    shadow.appendChild(style);
    document.documentElement.appendChild(host);
  }

  function placeAt(el, rect) {
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    el.style.left = "-9999px";
    el.style.top = "-9999px";
    requestAnimationFrame(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.min(Math.max(margin, rect.left), vw - w - margin);
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
    lastInfo = info;
    hideIcon();
    showBubble(info.rect);
    setBubbleThinking();

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
        if (res?.error) setBubbleError(res);
        else setBubbleText(res?.explanation || "No explanation returned.");
      })
      .catch((e) => {
        if (bubble) setBubbleError({ error: String(e?.message || e), code: "GENERIC" });
      });
  }

  function showBubble(rect) {
    ensureHost();
    hideBubble();
    bubble = document.createElement("div");
    bubble.className = "dii-bubble";
    bubble.innerHTML = `
      <div class="dii-head">
        <span class="dii-brand">doubleii</span>
        <span class="dii-actions">
          <button class="dii-btn dii-retry" title="Retry">${RETRY_SVG}</button>
          <button class="dii-btn dii-close" title="Close">${CLOSE_SVG}</button>
        </span>
      </div>
      <div class="dii-body"></div>`;
    bubble.querySelector(".dii-close").addEventListener("click", hideBubble);
    bubble.querySelector(".dii-retry").addEventListener("click", () => startExplain(lastInfo));
    bubble.querySelector(".dii-head").addEventListener("mousedown", startDrag);
    shadow.appendChild(bubble);
    placeAt(bubble, rect);
  }

  // ---- drag ---------------------------------------------------------------

  function startDrag(e) {
    if (e.target.closest(".dii-btn")) return; // don't drag when clicking buttons
    e.preventDefault();
    isDragging = true;
    const rect = bubble.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    bubble.style.cursor = "grabbing";
    document.addEventListener("mousemove", onDragMove, true);
    document.addEventListener("mouseup", stopDrag, true);
  }

  function onDragMove(e) {
    if (!isDragging || !bubble) return;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = bubble.offsetWidth;
    const h = bubble.offsetHeight;
    const left = Math.min(Math.max(margin, e.clientX - dragOffsetX), vw - w - margin);
    const top  = Math.min(Math.max(margin, e.clientY - dragOffsetY), vh - h - margin);
    bubble.style.left = `${left}px`;
    bubble.style.top  = `${top}px`;
  }

  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener("mousemove", onDragMove, true);
    document.removeEventListener("mouseup", stopDrag, true);
    if (bubble) bubble.style.cursor = "";
  }

  function bodyEl() {
    return bubble && bubble.querySelector(".dii-body");
  }

  function stopThinking() {
    if (thinkTimer) {
      clearInterval(thinkTimer);
      thinkTimer = null;
    }
  }

  function setBubbleThinking() {
    const body = bodyEl();
    if (!body) return;
    body.className = "dii-body";
    body.innerHTML = `<div class="dii-think"><span class="dii-think-text"></span></div>`;
    const textEl = body.querySelector(".dii-think-text");
    let i = 0;
    textEl.textContent = THINKING_MESSAGES[0];
    stopThinking();
    thinkTimer = setInterval(() => {
      i = Math.min(i + 1, THINKING_MESSAGES.length - 1);
      textEl.textContent = THINKING_MESSAGES[i];
    }, 2200);
  }

  function setBubbleText(text) {
    stopThinking();
    const body = bodyEl();
    if (!body) return;
    body.className = "dii-body";
    body.textContent = text;
  }

  function setBubbleError({ error, code }) {
    stopThinking();
    const body = bodyEl();
    if (!body) return;
    const settingsCodes = code === "NO_KEY" || code === "AUTH";
    const message =
      code === "NO_KEY"
        ? "No API key set yet. Add your key in Settings to start explaining."
        : error || "Something went wrong. Please retry.";
    const actionLabel = settingsCodes ? "Open Settings" : "Retry";

    body.className = "dii-body";
    body.innerHTML = `
      <div class="dii-err">
        <div class="dii-err-label">Couldn't explain</div>
        <div class="dii-err-msg"></div>
        <button class="dii-action">${actionLabel}</button>
      </div>`;
    body.querySelector(".dii-err-msg").textContent = message;
    body.querySelector(".dii-action").addEventListener("click", () => {
      if (settingsCodes) chrome.runtime.sendMessage({ type: "doubleii:open-options" });
      else startExplain(lastInfo);
    });
  }

  function hideBubble() {
    stopDrag();
    stopThinking();
    if (bubble) {
      bubble.remove();
      bubble = null;
    }
  }

  // ---- assets -------------------------------------------------------------

  const EYES_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="8.5" cy="12" r="2.4" fill="currentColor"/>
    <circle cx="15.5" cy="12" r="2.4" fill="currentColor"/></svg>`;
  const CLOSE_SVG = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  const RETRY_SVG = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M11.5 7a4.5 4.5 0 1 1-1.32-3.18M11.5 1.5V4H9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function fontFaceCSS() {
    const inter = chrome.runtime.getURL("fonts/inter-var.woff2");
    const pf400 = chrome.runtime.getURL("fonts/playfair-400.woff2");
    const pf600 = chrome.runtime.getURL("fonts/playfair-600.woff2");
    return `
      @font-face { font-family: 'dii-Sans'; font-weight: 400 600; font-display: swap; src: url(${inter}) format('woff2'); }
      @font-face { font-family: 'dii-Serif'; font-weight: 400; font-display: swap; src: url(${pf400}) format('woff2'); }
      @font-face { font-family: 'dii-Serif'; font-weight: 600; font-display: swap; src: url(${pf600}) format('woff2'); }`;
  }

  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; }

    .dii-icon {
      position: fixed; display: inline-flex; align-items: center; gap: 6px;
      font: 600 13px/1 'dii-Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: -0.01em; color: #ffffff; background: #000000; border: 0;
      border-radius: 9px; padding: 8px 11px; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,.28);
    }
    .dii-icon:hover { background: #181818; }

    .dii-bubble {
      position: fixed; width: 328px; max-width: 92vw;
      background: #181818; color: #f5f4f2; border: 1px solid rgba(255,255,255,.08);
      border-radius: 14px; box-shadow: 0 14px 44px rgba(0,0,0,.4); overflow: hidden;
      font: 400 14px/1.6 'dii-Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: -0.003em;
    }
    .dii-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 12px 9px 15px; border-bottom: 1px solid rgba(255,255,255,.07);
      cursor: grab; user-select: none;
    }
    .dii-head:active { cursor: grabbing; }
    .dii-brand {
      font: 600 16px/1.3 'dii-Serif', Georgia, serif; letter-spacing: 0.01em; color: #ffffff;
    }
    .dii-actions { display: inline-flex; gap: 2px; }
    .dii-btn {
      background: transparent; border: 0; color: #9a9a9a; cursor: pointer;
      padding: 5px; border-radius: 7px; display: inline-flex; line-height: 0;
    }
    .dii-btn:hover { color: #ffffff; background: rgba(255,255,255,.08); }

    .dii-body { padding: 14px 15px 16px; white-space: pre-wrap; }

    /* thinking shimmer */
    .dii-think { padding: 6px 0 8px; }
    .dii-think-text {
      font-size: 14px; font-weight: 500;
      background: linear-gradient(90deg, #6d6d6d 30%, #ffffff 50%, #6d6d6d 70%);
      background-size: 220% 100%; -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent; color: transparent;
      animation: dii-shimmer 1.7s linear infinite;
    }
    @keyframes dii-shimmer { 0% { background-position: 120% 0; } 100% { background-position: -120% 0; } }

    /* error state */
    .dii-err-label {
      font: 400 10px/1 'dii-Sans', monospace; text-transform: uppercase;
      letter-spacing: 0.14em; color: #9a9a9a; margin-bottom: 8px;
    }
    .dii-err-msg { color: #e8e6e2; margin-bottom: 13px; }
    .dii-action {
      font: 600 12.5px/1 'dii-Sans', sans-serif; cursor: pointer;
      background: #ffffff; color: #000000; border: 0; border-radius: 8px; padding: 9px 14px;
    }
    .dii-action:hover { background: #e8e6e2; }`;
})();
