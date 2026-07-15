'use strict';

/**
 * One-time auto-enable of the Buildomator (`bm`) plugin, invoked from the gsd
 * SessionStart hook to smooth the /bm: to /bm: migration.
 *
 * Marker meaning: the marker file records that "gsd has observed bm enabled at
 * least once". It is written on BOTH the enable path and the already-enabled
 * path, but NOT on the not-cached path. Once the marker exists, this helper never
 * touches enabledPlugins again, so a later deliberate disable by the user stands
 * and is never overridden.
 *
 * All three paths are injectable so the unit spec can drive the helper against
 * temp dirs; the caller supplies the real homedir defaults. The whole body is
 * wrapped in try/catch and never throws: a malformed or missing settings file, a
 * failed cache scan, or a failed write is a swallowed no-op, so a SessionStart
 * hook can never be broken by this feature.
 */

const fs = require('fs');
const path = require('path');

/**
 * Pick the target marketplace from the ones that hold a bm package. Preference:
 * buildomator first, then gsd-plugin, then any remaining names sorted ascending.
 * @param {string[]} names - marketplace names known to hold bm
 * @returns {string}
 */
function chooseMarketplace(names) {
  const preferred = ['buildomator', 'gsd-plugin'];
  for (const p of preferred) {
    if (names.includes(p)) return p;
  }
  return names.filter((n) => !preferred.includes(n)).sort()[0];
}

/**
 * Enable bm exactly once if it is cached but not yet enabled and no marker exists.
 * @param {{cacheRoot: string, settingsPath: string, markerPath: string}} paths
 * @returns {{acted: boolean, marketplace?: string, reason?: string}}
 */
function autoEnableBm({ cacheRoot, settingsPath, markerPath } = {}) {
  try {
    // 1. Marker gate: once gsd has observed bm enabled, never manage it again.
    if (fs.existsSync(markerPath)) {
      return { acted: false, reason: 'marker-exists' };
    }

    // 2. Cache scan: a marketplace "has bm" when <cacheRoot>/<mp>/bm is a
    //    directory with at least one child (a version dir). Cache layout mirrors
    //    ~/.claude/plugins/cache/<marketplace>/<pkg>/<version>/.
    let marketplaces = [];
    try {
      marketplaces = fs.readdirSync(cacheRoot);
    } catch {
      marketplaces = [];
    }
    const withBm = [];
    for (const mp of marketplaces) {
      try {
        const children = fs.readdirSync(path.join(cacheRoot, mp, 'bm'));
        if (children.length > 0) withBm.push(mp);
      } catch {
        // No bm under this marketplace.
      }
    }
    // Nothing to enable yet: return WITHOUT a marker so a later install can still
    // trigger the one-time enable.
    if (withBm.length === 0) {
      return { acted: false, reason: 'not-cached' };
    }
    const marketplace = chooseMarketplace(withBm);
    const key = 'bm@' + marketplace;

    // 3. Read settings (guarded). A missing or malformed file is a no-op that
    //    retries next session; no marker is written on a read/parse error.
    let settings;
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      return { acted: false, reason: 'error' };
    }
    if (!settings || typeof settings !== 'object') {
      return { acted: false, reason: 'error' };
    }
    const enabled =
      settings.enabledPlugins && typeof settings.enabledPlugins === 'object'
        ? settings.enabledPlugins
        : null;

    // 4. Already-enabled branch: if any bm@ key is truthy, record the observation
    //    by writing the marker (no settings change). This is the core fix: it
    //    means a subsequent user disable is never overridden.
    if (enabled && Object.keys(enabled).some((k) => k.startsWith('bm@') && enabled[k])) {
      fs.writeFileSync(markerPath, new Date().toISOString());
      return { acted: false, reason: 'already-enabled' };
    }

    // 5. Enable branch (cached + not enabled). The JSON round-trip reformats the
    //    user's settings.json (2-space reindent, possible key reordering); that
    //    is the accepted trade-off for a safe atomic write. Write to a temp file
    //    in the SAME directory as settings.json, then rename over it so a reader
    //    never sees a half-written file. Write the marker LAST, only after the
    //    rename succeeds, so a failed write retries next session.
    if (!settings.enabledPlugins || typeof settings.enabledPlugins !== 'object') {
      settings.enabledPlugins = {};
    }
    settings.enabledPlugins[key] = true;
    const tmp = settingsPath + '.gsd-tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
    fs.renameSync(tmp, settingsPath);
    fs.writeFileSync(markerPath, new Date().toISOString());
    return { acted: true, marketplace };
  } catch {
    // Fail-soft: never throw, never break session start.
    return { acted: false, reason: 'error' };
  }
}

module.exports = { autoEnableBm };
