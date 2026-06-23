# Contributing to doubleii

Thanks for wanting to help! doubleii is a small, dependency-free browser
extension, so it's easy to get started.

## Have an idea or found a bug?

Open an issue — there are templates for **bug reports** and **ideas / feature
requests**. No idea is too small. If it's more of an open question, use
**Discussions**.

> 🔒 **Never paste an API key or any secret** into an issue, PR, commit, or
> screenshot. Keys belong only in your local extension settings.

## Running it locally

1. Clone the repo.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
   and select the project folder.
3. Add your provider key via the doubleii icon → **Settings**.
4. After editing files, hit the **reload** button on the doubleii card in
   `chrome://extensions` to pick up changes.

There's no build step. The code is plain JS:

- `src/content/content.js` runs on the page (plain script — no imports).
- `src/background/service-worker.js` and `src/lib/*` are ES modules.
- Extension pages live in `src/options`, `src/popup`, `src/history`.

## Submitting a change

1. Fork and create a branch.
2. Keep changes focused and match the surrounding style.
3. Don't add dependencies or a build step without discussing it first in an issue.
4. Open a PR describing what changed and how you tested it.

## Cutting a release

The website's download buttons point at a **version-independent** URL:

```
https://github.com/Lohomi15/doubleii/releases/latest/download/doubleii.zip
```

GitHub serves that from whichever release is newest — but only if every release
attaches an asset named **exactly `doubleii.zip`**. So when publishing a release:

1. Bump `version` in `manifest.json` and add a `CHANGELOG.md` entry.
2. Build a clean ZIP containing only the runtime files —
   `manifest.json`, `src/`, `icons/`, `fonts/` (no `docs/`, `.git`, `safari/`, etc.).
3. Attach it to the release **twice**:
   - `doubleii.zip` — stable name the website and the in-app update notice rely on.
   - `doubleii-vX.Y.Z.zip` — optional, version-stamped for humans browsing assets.
4. Tag as `vX.Y.Z` so the in-app update check (`src/lib/update-check.js`) compares
   correctly against `manifest.json`'s `version`.

If you skip the `doubleii.zip` asset, the homepage "Get Extension" button 404s.
The website never needs editing per release — only the release assets matter.

## Good first issues

Check the [issues labelled `good first issue`](https://github.com/Lohomi15/doubleii/labels/good%20first%20issue).
