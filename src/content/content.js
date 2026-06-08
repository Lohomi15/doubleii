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

  // Returns true when the extension has been reloaded/updated and this content
  // script's runtime connection is severed. Any chrome.runtime call will throw
  // "Extension context invalidated" in that state.
  function runtimeDead() {
    try { return !chrome.runtime?.id; } catch { return true; }
  }

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
  let inFlight = false; // prevent concurrent explain calls
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
    return !!(host && node && node.closest && node.closest(`#${HOST_ID}`) === host);
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
    if (!info || inFlight) return;
    if (runtimeDead()) {
      showBubble(info.rect);
      setBubbleError({ error: "The extension was reloaded — refresh this page to continue.", code: "GENERIC" });
      return;
    }
    inFlight = true;
    lastInfo = info;
    hideIcon();
    showBubble(info.rect);
    setBubbleThinking();

    let payload;
    try {
      payload = {
        id: `${info.rect.top | 0}-${performance.now() | 0}-${(Math.random() * 1e6) | 0}`,
        selectedText: info.text,
        context: extractContext(info.range, info.text),
        title: document.title || "",
        url: location.href,
        fragmentUrl: buildFragmentUrl(info.text),
        ts: Date.now(),
      };
    } catch (e) {
      inFlight = false;
      if (bubble) setBubbleError({ error: "Couldn't read the page context. Try again.", code: "GENERIC" });
      return;
    }

    chrome.runtime
      .sendMessage({ type: "doubleii:explain", payload })
      .then((res) => {
        inFlight = false;
        if (!bubble) return;
        if (res?.error) setBubbleError(res);
        else setBubbleText(res?.explanation || "No explanation returned.", res);
      })
      .catch((e) => {
        inFlight = false;
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
      if (!bodyEl()) { stopThinking(); return; }
      i = Math.min(i + 1, THINKING_MESSAGES.length - 1);
      textEl.textContent = THINKING_MESSAGES[i];
    }, 2200);
  }

  function setBubbleText(text, meta) {
    stopThinking();
    if (!bubble) return;

    // Build content in a fresh element, then swap out the old body entirely.
    // Replacing (not clearing) guarantees the shimmer element is gone from the DOM —
    // clearing innerHTML can leave the GPU-composited animation visually alive.
    const newBody = document.createElement("div");
    newBody.className = "dii-body";

    const expl = document.createElement("div");
    expl.className = "dii-expl";
    expl.textContent = text;
    newBody.appendChild(expl);

    const totalTokens = (meta?.inputTokens || 0) + (meta?.outputTokens || 0);
    if (totalTokens > 0) {
      const footer = document.createElement("div");
      footer.className = "dii-cost";
      const tStr = totalTokens >= 1000
        ? `${(totalTokens / 1000).toFixed(1)}k`
        : String(totalTokens);
      const cost = meta?.cost || 0;
      const cStr = cost < 0.0001 ? "<$0.0001" : `$${cost.toFixed(4)}`;
      const extIcon = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true" style="display:inline-block;vertical-align:middle;margin-left:3px;margin-bottom:1px"><path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M8 1h3m0 0v3m0-3L6 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      footer.innerHTML =
        `<span class="dii-cost-num">${tStr} tokens · ${cStr}</span>` +
        `<button class="dii-cost-link">Total cost${extIcon}</button>`;
      footer.querySelector(".dii-cost-link").addEventListener("click", () => {
        try { chrome.runtime.sendMessage({ type: "doubleii:open-options" }); } catch {}
      });
      newBody.appendChild(footer);
    }

    const oldBody = bubble.querySelector(".dii-body");
    if (oldBody) oldBody.replaceWith(newBody); else bubble.appendChild(newBody);
  }

  function setBubbleError({ error, code }) {
    stopThinking();
    if (!bubble) return;
    const settingsCodes = code === "NO_KEY" || code === "AUTH";
    const message =
      code === "NO_KEY"
        ? "No API key set yet. Add your key in Settings to start explaining."
        : error || "Something went wrong. Please retry.";
    const actionLabel = settingsCodes ? "Open Settings" : "Retry";

    const newBody = document.createElement("div");
    newBody.className = "dii-body";
    const errLabel = document.createElement("div"); errLabel.className = "dii-err-label"; errLabel.textContent = "Couldn't explain";
    const errMsg = document.createElement("div"); errMsg.className = "dii-err-msg"; errMsg.textContent = message;
    const btn = document.createElement("button"); btn.className = "dii-action"; btn.textContent = actionLabel;
    btn.addEventListener("click", () => {
      if (settingsCodes) {
        try { chrome.runtime.sendMessage({ type: "doubleii:open-options" }); } catch {}
      } else {
        startExplain(lastInfo);
      }
    });
    const errWrap = document.createElement("div"); errWrap.className = "dii-err";
    errWrap.append(errLabel, errMsg, btn);
    newBody.appendChild(errWrap);

    const oldBody = bubble.querySelector(".dii-body");
    if (oldBody) oldBody.replaceWith(newBody); else bubble.appendChild(newBody);
  }

  function hideBubble() {
    inFlight = false;
    stopDrag();
    stopThinking();
    if (bubble) {
      bubble.remove();
      bubble = null;
    }
  }

  // Clean up on page navigation / unload so drag listeners don't linger.
  window.addEventListener("pagehide", hideBubble);

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

    .dii-body { padding: 14px 15px 0; white-space: pre-wrap; }
    .dii-expl { padding-bottom: 14px; }
    .dii-cost {
      display: flex; align-items: center; justify-content: space-between;
      border-top: 1px solid rgba(255,255,255,.07); padding: 8px 0 12px; gap: 8px;
    }
    .dii-cost-num {
      font: 400 10.5px/1 'dii-Sans', monospace; color: #6d6d6d; letter-spacing: 0.02em;
    }
    .dii-cost-link {
      background: transparent; border: 0; color: #9a9a9a; cursor: pointer;
      font: 400 10.5px/1 'dii-Sans', sans-serif; padding: 0;
      text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px;
      white-space: nowrap;
    }
    .dii-cost-link:hover { color: #f5f4f2; }

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
