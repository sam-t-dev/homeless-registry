/**
 * Cloudflare Worker: registry ingest → GitHub Contents API upsert of data/records.json
 * on main + gh-pages. Secrets (wrangler secret put): REGISTRY_GH_TOKEN, REGISTRY_INGEST_KEY.
 * Never embed a GitHub PAT in client JS.
 */

const OWNER = 'sam-t-dev';
const REPO = 'homeless-registry';
const PATH = 'data/records.json';
const BRANCHES = ['main', 'gh-pages'];
const API = 'https://api.github.com';

const ALLOWED_ORIGINS = new Set([
  'https://sam-t-dev.github.io',
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);

function corsHeaders(origin) {
  const allow =
    origin &&
    (ALLOWED_ORIGINS.has(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      origin === 'https://sam-t-dev.github.io')
      ? origin
      : 'https://sam-t-dev.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  });
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'homeless-registry-ingest-worker',
  };
}

async function gh(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...authHeaders(token),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = (data && data.message) || text || res.statusText;
    const err = new Error(`${method} ${path} -> ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64Decode(b64) {
  const bin = atob(String(b64 || '').replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function getFile(branch, token) {
  try {
    return await gh('GET', `/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${branch}`, token);
  } catch (e) {
    if (e.status === 404 || String(e.message).includes('404')) return null;
    throw e;
  }
}

function decodeRecords(file) {
  if (!file || !file.content) return [];
  const raw = b64Decode(file.content);
  const parsed = JSON.parse(raw || '[]');
  if (!Array.isArray(parsed)) throw new Error('records.json is not an array');
  return parsed;
}

function upsert(records, record) {
  const id = record.id;
  if (!id) throw new Error('record.id required');
  const i = records.findIndex((r) => r && r.id === id);
  if (i >= 0) records[i] = { ...records[i], ...record };
  else records.push(record);
  return records;
}

function normalizeRecord(record) {
  return {
    id: String(record.id),
    country: record.country ?? '',
    countryCode: record.countryCode ?? '',
    city: record.city ?? '',
    category: record.category ?? 'other',
    duration: record.duration ?? '',
    needs: Array.isArray(record.needs) ? record.needs : [],
    timestamp: record.timestamp || new Date().toISOString(),
  };
}

async function putRecords(branch, records, sha, message, token) {
  const content = b64Encode(JSON.stringify(records, null, 2) + '\n');
  const body = { message, content, branch };
  if (sha) body.sha = sha;
  return gh('PUT', `/repos/${OWNER}/${REPO}/contents/${PATH}`, token, body);
}

async function syncBranch(branch, record, token) {
  let file = await getFile(branch, token);
  let records = file ? decodeRecords(file) : [];
  records = upsert(records, record);
  const message = `registry: upsert ${record.id} [skip ci]`;
  let result;
  try {
    result = await putRecords(branch, records, file && file.sha, message, token);
  } catch (e) {
    if (e.status === 409 || String(e.message).includes('409')) {
      file = await getFile(branch, token);
      records = file ? decodeRecords(file) : [];
      records = upsert(records, record);
      result = await putRecords(branch, records, file && file.sha, message, token);
    } else {
      throw e;
    }
  }
  return {
    branch,
    count: records.length,
    commit: result.commit && result.commit.sha ? result.commit.sha.slice(0, 7) : undefined,
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'POST only' }, 405, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body' }, 400, origin);
    }

    const recordIn = payload && payload.record;
    const ingestKey = (payload && payload.ingestKey) || '';

    if (!recordIn || typeof recordIn !== 'object' || Array.isArray(recordIn)) {
      return json({ ok: false, error: 'Missing or invalid record object' }, 400, origin);
    }
    if (!recordIn.id) {
      return json({ ok: false, error: 'record.id is required' }, 400, origin);
    }

    const expected = env.REGISTRY_INGEST_KEY || '';
    if (expected && ingestKey !== expected) {
      return json({ ok: false, error: 'ingestKey mismatch or missing' }, 401, origin);
    }

    const token = env.REGISTRY_GH_TOKEN;
    if (!token) {
      return json({ ok: false, error: 'Server misconfigured (REGISTRY_GH_TOKEN)' }, 500, origin);
    }

    let record;
    try {
      record = normalizeRecord(recordIn);
    } catch (e) {
      return json({ ok: false, error: e.message || 'Invalid record' }, 400, origin);
    }

    const results = [];
    for (const branch of BRANCHES) {
      try {
        results.push(await syncBranch(branch, record, token));
      } catch (e) {
        results.push({ branch, error: e.message || String(e) });
      }
    }

    const ok = results.every((r) => !r.error);
    if (!ok) {
      return json({ ok: false, error: 'GitHub upsert failed', results }, 502, origin);
    }
    return json({ ok: true, results }, 200, origin);
  },
};
