# doubleii

**An extra pair of AI-powered eyes for anything you read.**

Highlight any line in any article and get a simple, context-aware explanation —
right where you're reading, in a floating bubble. Bring your own key. No servers.

**Website:** https://lohomi15.github.io/doubleii  
**Shortcut:** ⌥B on Mac · Alt+B on Windows/Linux

---

## The problem

You're reading an article and most of it lands — but one or two specific
sentences don't. Today you'd copy those lines, switch to an LLM, paste them,
provide context, and ask. doubleii collapses that into: **highlight → ⌥B →
read the answer.**

Chat apps already solve this for their own replies ("ask follow-up"). Articles
on the open web don't have that. That's the gap doubleii fills.

## How it works

1. Select any line in any article.
2. A small **Explain** button appears near your selection. Click it, press
   **⌥B** (Mac) or **Alt+B** (Windows), or right-click → *Explain with doubleii*.
3. doubleii reads the surrounding article for context and sends the highlighted
   passage to your chosen model.
4. The explanation appears in a floating bubble. It's also saved to your local
   **History** with a link back to the exact line.

In **Settings** you can choose the **provider** (Anthropic or OpenAI), the
**response language** (English, Hindi, Japanese, Korean, Spanish, Chinese,
French), and edit the **system prompt** (leave blank to use the default).

## Privacy

- **doubleii has no servers.** There is no backend. We never receive your text,
  key, or history. Nothing to leak.
- **Your API key stays on your device** — stored in `chrome.storage.local`,
  only ever used in the `Authorization` header of the call *you* make to the
  provider *you* chose.
- **Your reading history stays on your device** — local only, never synced.
- The highlighted text and article context go **directly** from your browser to
  your chosen provider, using your own key. Paid API tiers generally don't train
  on your data by default.

## Install (Chrome / Brave / Edge / Arc)

doubleii is distributed directly from this repo — no Chrome Web Store needed.
Loading an unpacked extension takes about 30 seconds.

```
1. Click the green "Code" button above → Download ZIP → unzip it
   (or: git clone https://github.com/Lohomi15/doubleii)
2. Open chrome://extensions in your browser
3. Toggle on Developer mode (top-right switch)
4. Click Load unpacked → select the unzipped doubleii folder
5. Pin doubleii from the extensions puzzle-piece menu
6. Click the doubleii icon → Settings → add your API key
7. Open any article, highlight a line, press ⌥B (Mac) or Alt+B (Windows)
```

**API key sources:**
- Anthropic → https://console.anthropic.com/settings/keys
- OpenAI    → https://platform.openai.com/api-keys

**Local HTML files:** enable *"Allow access to file URLs"* on the doubleii card
at `chrome://extensions`.

> Safari (via Xcode app wrapper) and PDF support are on the roadmap.

## Architecture

```
manifest.json              Manifest V3 — permissions, commands, content script
src/
  content/content.js       Runs on every page. Detects selections, extracts
                           article context (nearest article/main + windowed
                           fallback), renders the floating bubble via Shadow DOM
  background/
    service-worker.js      Extension's private backend. Holds the API key,
                           routes provider calls, saves history. Never exposed
                           to the page.
  lib/
    providers.js           Anthropic + OpenAI fetch calls with typed error codes
    prompt.js              System prompt, default text, language composer
    storage.js             chrome.storage.local wrappers (settings + history)
  options/                 Settings page (provider, key, model, language, prompt)
  popup/                   Toolbar icon popup (status + links to settings/history)
  history/                 Local history page — card stack, "Open article" links
fonts/                     Self-hosted Inter, Playfair Display, JetBrains Mono
                           (latin subset, SIL OFL)
docs/                      GitHub Pages landing page
tools/make_icons.py        Generates placeholder extension icons
```

**Why the key lives in the service worker, not the content script:**
Content scripts run inside the page and share that JS context — a rogue page
script could in principle inspect them. The service worker is isolated. It also
gets `host_permissions` CORS bypass to call `api.anthropic.com` and
`api.openai.com` directly from the browser without a proxy.

**Why Shadow DOM for the bubble:**
The bubble injects HTML into millions of different pages. Shadow DOM creates a
complete style boundary so no page stylesheet can break the bubble's layout, and
the bubble can't accidentally inherit the page's fonts, colors, or resets.

## Development

No build step. Plain ES modules.

```bash
# After cloning, load immediately:
# chrome://extensions → Developer mode → Load unpacked → select this folder

# To iterate: edit a file, then hit the reload icon on the extension card.

# Regenerate icons (after changing BG/EYE colours in the script):
python3 tools/make_icons.py
```

## Roadmap

Issues are tracked on GitHub. Current priorities:

- [#1] Stream the explanation token-by-token
- [#2] Configurable trigger key (Wispr/Linear style)
- [#3] Local model support via Ollama (fully offline)
- [#4] Swap heuristic context extraction for Readability.js
- [#5] Adjustable explanation depth (simpler / more detail)
- [#6] Safari support via Xcode wrapper
- [#8] Replace placeholder icons with real branding

## Contributing

Issues and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

**Never commit API keys or secrets** — keys belong only in your local extension
settings. The `.gitignore` blocks `.env` and common secret file patterns.

## Fonts

Self-hosted latin-subset woff2 files, each under the SIL Open Font License:
**Inter**, **Playfair Display** (400, 600, 700), **JetBrains Mono**.

## License

[MIT](LICENSE) — doubleii's own code. Bundled fonts are under the SIL OFL.
