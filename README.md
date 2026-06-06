<div align="center">

# 👀 doubleii

**An extra pair of AI-powered eyes for whatever you're reading.**

Highlight any line in any article and get a simple, context-aware explanation —
right where you're reading it. Bring your own key. No servers, no tracking.

</div>

---

## The problem

You're reading an article, a post, a docs page. You get the broad idea, but one
or two specific lines don't land. Today you'd copy that line, switch to an LLM,
paste it, add context, and ask. doubleii collapses that into: **highlight → explain.**

Chat apps already solve this for their own replies (the "ask follow-up" button).
**Articles on the internet don't.** That's the gap doubleii fills.

## How it works

1. Select a line in any article.
2. A small **Explain** button appears (or press **Alt+B**, or right-click → *Explain with doubleii*).
3. doubleii reads the surrounding article for context and asks your chosen model
   to explain *that line* in plain language.
4. The answer appears in a floating bubble, and is saved to your local **History**.

The explanation is written for "simple language that anyone with a decent
general education can understand" — not a generic dictionary definition, but an
explanation grounded in *what you're actually reading*.

In **Settings** you can choose your **provider** (Anthropic or OpenAI), the
**response language** (English, Hindi, Japanese, Korean, Spanish, Chinese,
French), and edit the **system prompt** if you want to change how explanations
are written (leave it blank to use the default).

## Your data & privacy

This is the important part, and it's deliberately simple:

- **doubleii has no servers.** There is no backend. We never receive your text,
  your key, or your history. There's nothing to leak.
- **Your API key stays on your device** (`chrome.storage.local`). It's only ever
  sent in the `Authorization` header of the request *you* make to the provider
  *you* chose.
- **Your reading history stays on your device too** — local only, never synced.
- **What does leave your browser:** the line you highlighted plus the surrounding
  article context go **directly** from your browser to your chosen AI provider
  (Anthropic or OpenAI), using your key. To explain a line, the model has to see
  it. Those providers' API data policies apply (paid API tiers generally don't
  train on your data by default).

> TL;DR — doubleii never sees your data. Your text goes straight from your
> browser to the AI provider you picked, with your own key.

## Install (Chrome / Brave / Edge / Arc)

doubleii is an unpacked extension while in development:

1. Clone this repo.
2. (Optional) regenerate placeholder icons: `python3 tools/make_icons.py`
3. Open `chrome://extensions`, turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. Click the doubleii toolbar icon → **Settings**, choose a provider, and paste
   your API key:
   - Anthropic: https://console.anthropic.com/settings/keys
   - OpenAI: https://platform.openai.com/api-keys
6. Open any article, highlight a line, and press **Alt+B**.

**Local HTML files:** to use doubleii on `file://` pages, enable
*"Allow access to file URLs"* on the doubleii card in `chrome://extensions`.

> **Safari** support (via an Xcode app wrapper) and **PDF** support are on the
> roadmap, not in this version.

## Architecture

```
manifest.json            MV3 manifest (content script, SW, popup, options)
src/
  content/content.js     Selection detection, context extraction, floating bubble (Shadow DOM)
  background/
    service-worker.js    Holds the key, calls the provider, saves history
  lib/
    providers.js         Anthropic + OpenAI API calls
    prompt.js            System + user prompt construction
    storage.js           chrome.storage.local wrappers (settings + history)
  options/               Settings page (provider, key, model)
  popup/                 Toolbar popup (status + links)
  history/               Local history of past asks
```

**Why the key lives in the service worker, not the content script:** content
scripts share the page with the site's own JavaScript, so keeping the key out of
that context is safer. The service worker is also allowed to call the provider
APIs cross-origin (via `host_permissions`) without CORS problems.

## Roadmap

- Streaming token-by-token answers
- Configurable trigger key (Wispr/Linear-style)
- Local model support (Ollama) for fully offline use
- Safari (Xcode wrapper) and in-page PDF support

## Contributing

Issues and PRs welcome. Please **never commit API keys** or other secrets — see
`.gitignore`. Keys belong only in your local extension settings.

## Fonts

The UI bundles three open-source fonts (latin subset, self-hosted so it works
offline), each under the SIL Open Font License: **Inter**, **Playfair Display**,
and **JetBrains Mono**.

## License

[MIT](LICENSE) (doubleii's own code). Bundled fonts are under the SIL OFL.
