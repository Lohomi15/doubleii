// Update check. doubleii has no server and Chrome does not auto-update an
// extension loaded unpacked / from a ZIP, so we ask GitHub Releases what the
// latest published version is and compare it to the installed one.
//
// The result is cached in chrome.storage.local and refreshed at most once every
// CHECK_TTL_MS, so a normal explain flow never waits on (or hammers) GitHub.

const RELEASES_API = "https://api.github.com/repos/Lohomi15/doubleii/releases/latest";
export const RELEASES_PAGE = "https://github.com/Lohomi15/doubleii/releases/latest";

const CACHE_KEY = "updateCheck";
const CHECK_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// "v0.1.0" / "0.1.0" → [0, 1, 0]. Non-numeric / missing parts become 0.
function parseVersion(v) {
  return String(v || "")
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

// True when `latest` is a strictly higher version than `current`.
export function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

// Returns { available, latest } describing whether a newer release exists.
// Never throws — any network/parse failure resolves to "no update known", so an
// explanation is never blocked or broken by the version check.
export async function getUpdateStatus() {
  const current = chrome.runtime.getManifest().version;
  let latest = "";

  try {
    const cached = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
    const fresh = cached && Date.now() - cached.checkedAt < CHECK_TTL_MS;

    if (fresh) {
      latest = cached.latestVersion || "";
    } else {
      const res = await fetch(RELEASES_API, {
        headers: { accept: "application/vnd.github+json" },
      });
      if (res.ok) {
        const data = await res.json();
        latest = (data.tag_name || "").replace(/^v/i, "");
      } else {
        // 404 = no published release yet; keep any previous cached value.
        latest = cached?.latestVersion || "";
      }
      await chrome.storage.local.set({
        [CACHE_KEY]: { latestVersion: latest, checkedAt: Date.now() },
      });
    }
  } catch {
    return { available: false, latest: "" };
  }

  return {
    available: !!latest && isNewer(latest, current),
    latest,
    page: RELEASES_PAGE,
  };
}
