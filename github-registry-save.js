/* POST registry records to Cloudflare Worker (REGISTRY_API_URL).
 * Uses window.REGISTRY_INGEST_KEY from registry-ingest-config.js (shared ingest
 * password — NOT a GitHub PAT). Never put REGISTRY_GH_TOKEN or any GitHub personal-access token
 * in this file or any committed client JS.
 * Sets window.REGISTRY_SAVE_HOOK for register-app.
 */
(function () {
  'use strict';

  window.REGISTRY_SAVE_HOOK = async function registrySaveHook(payload) {
    var record = payload && payload.record;
    if (!record || !record.id) throw new Error('Missing record for save hook');

    var url = window.REGISTRY_API_URL;
    if (!url || !String(url).trim()) {
      throw new Error(
        'REGISTRY_API_URL is empty. Deploy workers/registry-ingest (Cloudflare Worker), then set window.REGISTRY_API_URL in registry-api-config.js to the workers.dev URL.'
      );
    }

    var body = {
      record: record,
      ingestKey: window.REGISTRY_INGEST_KEY || undefined
    };

    var res = await fetch(String(url).replace(/\/$/, ''), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    var data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok || !data || !data.ok) {
      var detail = (data && data.error) || ('HTTP ' + res.status);
      throw new Error('Registry API save failed: ' + detail);
    }

    return { ok: true, githubOk: true, results: data.results };
  };
})();
