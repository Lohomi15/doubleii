# Changelog

All notable changes to doubleii are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### In Development
- Safari Web Extension for macOS 14+ (Sonoma / Sequoia / Tahoe)
  - Full MV3 service worker support
  - All features parity: explain bubble, history, settings, keyboard shortcut
  - Build via Xcode using the included safari/ setup files

### Planned
- Streaming (token-by-token) explanations
- Configurable trigger key
- Ollama / local model support for fully offline use
- Readability.js for cleaner article extraction
- Adjustable explanation depth

---

## [0.1.1] — In Development

### Added
- Safari Web Extension support (macOS 14+, Safari 17+) — see safari/README.md
- Token and cost tracking per explanation (shown in bubble and Settings)
- Usage breakdown in Settings: weekly history by model with costs
- Custom model dropdown with per-model hints (Haiku / Sonnet / Opus / GPT-4o)

### Fixed
- Shimmer loader persisting over explanation (innerHTML not cleared before append)
- History button silently broken (missing tabs permission in manifest)
- Extension context invalidated crash on stale service worker
- Concurrent explain race condition corrupting lastInfo state

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

### Security
- XSS prevention: all storage-sourced values rendered with textContent/createElement
- Prompt injection mitigation: safeEmbed() breaks """ delimiters in user content
- API error bodies logged internally only, never exposed to page context
- Content Security Policy: script-src 'self'; object-src 'self' for extension pages
- inFlight flag prevents concurrent explain race conditions
- Promise-chain serialization for addHistory prevents TOCTOU history drops
- runtimeDead() guard prevents "Extension context invalidated" crashes on stale runtime
