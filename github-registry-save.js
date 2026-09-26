/* Formspree primary + GitHub Contents API append to data/records.json on main & gh-pages.
 * Requires window.FORMSPREE_ENDPOINT (formspree-config.js) and optionally
 * window.REGISTRY_REPO + window.REGISTRY_GH_TOKEN (registry-write-config.js).
 * Sets window.REGISTRY_SAVE_HOOK so register-app uses this path.
 */
(function () {
  'use strict';

  async function postToFormspree(record) {
    const endpoint = window.FORMSPREE_ENDPOINT;
    if (!endpoint) throw new Error('Formspree endpoint not configured');
    const body = {
      _subject: 'Homeless registry submission',
      source: 'homeless-registry',
      country: record.country,
      countryCode: record.countryCode || '',
      city: record.city,
      category: record.category,
      duration: record.duration,
      needs: Array.isArray(record.needs) ? record.needs : (record.needs ? [record.needs] : []),
      recordId: record.id,
      token: record.id,
      updatedAt: record.timestamp || new Date().toISOString()
    };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch (e) { /* ignore */ }
      throw new Error('Formspree HTTP ' + res.status + (detail ? ': ' + detail.slice(0, 120) : ''));
    }
    return res.json().catch(function () { return {}; });
  }

  function b64EncodeUtf8(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64DecodeUtf8(b64) {
    var bin = atob(b64.replace(/\n/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function ghHeaders(token) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };
  }

  async function getRecordsFile(repo, branch, token) {
    var url = 'https://api.github.com/repos/' + repo + '/contents/data/records.json?ref=' + encodeURIComponent(branch);
    var res = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' });
    if (res.status === 404) {
      return { sha: null, records: [] };
    }
    if (!res.ok) {
      var t = '';
      try { t = await res.text(); } catch (e) { /* ignore */ }
      throw new Error('GitHub GET ' + branch + ' HTTP ' + res.status + (t ? ': ' + t.slice(0, 120) : ''));
    }
    var meta = await res.json();
    var raw = b64DecodeUtf8(meta.content || '');
    var arr;
    try {
      arr = JSON.parse(raw || '[]');
    } catch (e) {
      arr = [];
    }
    if (!Array.isArray(arr)) arr = [];
    return { sha: meta.sha, records: arr };
  }

  async function putRecordsFile(repo, branch, token, records, sha, recordId) {
    var content = b64EncodeUtf8(JSON.stringify(records, null, 2) + '\n');
    var body = {
      message: 'registry: append/update ' + recordId,
      content: content,
      branch: branch
    };
    if (sha) body.sha = sha;
    var url = 'https://api.github.com/repos/' + repo + '/contents/data/records.json';
    var res = await fetch(url, {
      method: 'PUT',
      headers: ghHeaders(token),
      body: JSON.stringify(body)
    });
    return res;
  }

  async function upsertBranch(repo, branch, token, record) {
    var got = await getRecordsFile(repo, branch, token);
    var list = got.records.slice();
    var idx = list.findIndex(function (r) { return r && r.id === record.id; });
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    var res = await putRecordsFile(repo, branch, token, list, got.sha, record.id);
    if (res.status === 409) {
      got = await getRecordsFile(repo, branch, token);
      list = got.records.slice();
      idx = list.findIndex(function (r) { return r && r.id === record.id; });
      if (idx >= 0) list[idx] = record;
      else list.push(record);
      res = await putRecordsFile(repo, branch, token, list, got.sha, record.id);
    }
    if (!res.ok) {
      var t = '';
      try { t = await res.text(); } catch (e) { /* ignore */ }
      throw new Error('GitHub PUT ' + branch + ' HTTP ' + res.status + (t ? ': ' + t.slice(0, 120) : ''));
    }
    return res.json().catch(function () { return {}; });
  }

  async function appendRecordToGitHub(record) {
    var token = window.REGISTRY_GH_TOKEN;
    var repo = window.REGISTRY_REPO || 'sam-t-dev/homeless-registry';
    if (!token) throw new Error('REGISTRY_GH_TOKEN missing');
    var branches = ['main', 'gh-pages'];
    var errors = [];
    for (var i = 0; i < branches.length; i++) {
      try {
        await upsertBranch(repo, branches[i], token, record);
      } catch (err) {
        errors.push(branches[i] + ': ' + (err && err.message ? err.message : String(err)));
      }
    }
    if (errors.length) {
      throw new Error('GitHub sync failed (' + errors.join('; ') + ')');
    }
    return { ok: true };
  }

  /**
   * REGISTRY_SAVE_HOOK payload: { action, record, records }
   * Formspree must succeed (hard fail). GitHub soft-fails after Formspree OK.
   * Returns { formspreeOk, githubOk, githubError? } for UI messaging.
   */
  window.REGISTRY_SAVE_HOOK = async function registrySaveHook(payload) {
    var record = payload && payload.record;
    if (!record || !record.id) throw new Error('Missing record for save hook');

    await postToFormspree(record);

    var result = { formspreeOk: true, githubOk: false, githubError: null };
    if (!window.REGISTRY_GH_TOKEN) {
      result.githubSkipped = true;
      return result;
    }
    try {
      await appendRecordToGitHub(record);
      result.githubOk = true;
    } catch (err) {
      result.githubError = err && err.message ? err.message : String(err);
      console.warn('GitHub registry sync failed after Formspree OK', result.githubError);
    }
    return result;
  };

  window.__registryAppendToGitHub = appendRecordToGitHub;
  window.__registryPostToFormspree = postToFormspree;
})();
