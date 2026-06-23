# Changelog

All notable changes to doubleii are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Update notice in the explanation bubble: when a newer release exists on GitHub,
  a line under the token/cost footer links to the latest release to re-download.
  Since doubleii doesn't auto-update, this surfaces when you're on a stale build.
  The check uses the GitHub Releases API, cached for 6 hours, and never blocks or
  breaks an explanation if it fails.

### Fixed
- The Explain button and explanation bubble no longer grow or shrink with browser
  zoom. doubleii's UI now keeps a constant on-screen size while you zoom the
  article in or out for readability.

### Planned
- Streaming (token-by-token) explanations
- Configurable trigger key
- Ollama / local model support for fully offline use
- Readability.js for cleaner article extraction
- Adjustable explanation depth
- Safari support via Xcode wrapper

---

## [0.1.0] — 2026-06-06

First public release.

### Added

**Core explain flow**
- Highlight any text on any article page → floating "Explain" button appears
- Trigger via click, ⌥B (Mac) / Alt+B (Windows), or right-click context menu
- Article context extracted from nearest `article`/`main` container with a
  windowed character-window fallback for pages without semantic markup
- Explanation rendered in a floating **Shadow DOM bubble** (isolated from every
  page's own CSS) with a shimmer "thinking" animation while waiting
- Retry button and typed error states: no key set → Open Settings; invalid key
  / auth failure → Open Settings; rate limit / out of credits → Retry; generic
  error → Retry

**Providers**
- Anthropic (Claude) and OpenAI — bring your own key
- Keys stored only in `chrome.storage.local` on the user's device
- API calls made directly from the browser (service worker) — no doubleii proxy

**Settings**
- Provider selector (Anthropic / OpenAI), model override, API key input
- Response language dropdown: English, Hindi, Japanese, Korean, Spanish,
  Chinese, French
- Editable system prompt with the default shown as placeholder; "Reset prompt"
  clears back to the default

**History**
- Every explanation saved locally (`chrome.storage.local`, up to 200 entries)
- History page: card stack — highlighted passage → explanation → "Open article"
- "Open article" uses Chrome text-fragment links to scroll back to the exact
  highlighted line
- Clear-all button

**Design system**
- Achromatic palette (paper-white surfaces, ink-black frames, greyscale muted)
- Playfair Display (400/600/700), Inter, JetBrains Mono — self-hosted latin
  subset, all SIL OFL

**Infrastructure**
- Manifest V3 (Chrome / Brave / Edge / Arc)
- GitHub Pages landing page at `lohomi15.github.io/doubleii`
- Issue templates (bug report + feature request), PR template, CONTRIBUTING.md
- MIT licence
