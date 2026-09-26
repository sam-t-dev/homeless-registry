#!/usr/bin/env node
/**
 * Upsert a registry record into data/records.json on main AND gh-pages via GitHub Contents API.
 * Auth: REGISTRY_GH_TOKEN env (fine-grained PAT). Never commit or print the token.
 *
 * Usage:
 *   source /workspace/.env.d/registry-secrets.sh
 *   node scripts/append-record.mjs '{"id":"...","country":"...","countryCode":"AU",...}'
 *   node scripts/append-record.mjs --remove test-agent-smoke
 *   node scripts/append-record.mjs --file /path/to/record.json
 */
import { readFileSync } from 'fs';

const OWNER = 'sam-t-dev';
const REPO = 'homeless-registry';
const PATH = 'data/records.json';
const BRANCHES = ['main', 'gh-pages'];
const API = 'https://api.github.com';

const token = process.env.REGISTRY_GH_TOKEN;
if (!token) {
  console.error('ERROR: REGISTRY_GH_TOKEN not set. source /workspace/.env.d/registry-secrets.sh');
  process.exit(1);
}
if (token.length < 20) {
  console.error('ERROR: REGISTRY_GH_TOKEN looks empty/short');
  process.exit(1);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'homeless-registry-append',
  };
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.message || text || res.statusText;
    throw new Error(`${method} ${path} -> ${res.status}: ${msg}`);
  }
  return data;
}

async function getFile(branch) {
  try {
    return await api('GET', `/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${branch}`);
  } catch (e) {
    if (String(e.message).includes('404')) return null;
    throw e;
  }
}

function decodeContent(file) {
  if (!file?.content) return [];
  const raw = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
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

function removeById(records, id) {
  return records.filter((r) => !(r && r.id === id));
}

async function putRecords(branch, records, sha, message) {
  const content = Buffer.from(JSON.stringify(records, null, 2) + '\n', 'utf8').toString('base64');
  const body = {
    message,
    content,
    branch,
  };
  if (sha) body.sha = sha;
  return api('PUT', `/repos/${OWNER}/${REPO}/contents/${PATH}`, body);
}

async function syncBranch(branch, mutator, message) {
  const file = await getFile(branch);
  let records = file ? decodeContent(file) : [];
  records = mutator(records);
  const result = await putRecords(branch, records, file?.sha, message);
  return { branch, count: records.length, commit: result.commit?.sha?.slice(0, 7) };
}

function parseArgs(argv) {
  if (argv[0] === '--remove') {
    return { mode: 'remove', id: argv[1] };
  }
  if (argv[0] === '--file') {
    const raw = readFileSync(argv[1], 'utf8');
    return { mode: 'upsert', record: JSON.parse(raw) };
  }
  if (!argv[0]) {
    console.error('Usage: append-record.mjs <json|\'-\'> | --file path | --remove id');
    process.exit(2);
  }
  const raw = argv[0] === '-' ? readFileSync(0, 'utf8') : argv[0];
  return { mode: 'upsert', record: JSON.parse(raw) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let mutator;
  let message;
  if (args.mode === 'remove') {
    if (!args.id) throw new Error('--remove requires id');
    mutator = (recs) => removeById(recs, args.id);
    message = `registry: remove ${args.id}`;
  } else {
    const r = args.record;
    if (!r.id) throw new Error('record.id required');
    mutator = (recs) => upsert(recs, r);
    message = `registry: upsert ${r.id}`;
  }

  const results = [];
  for (const branch of BRANCHES) {
    try {
      results.push(await syncBranch(branch, mutator, message));
    } catch (e) {
      console.error(`FAIL ${branch}:`, e.message);
      results.push({ branch, error: e.message });
    }
  }
  // Never print token; safe summary only
  console.log(JSON.stringify({ ok: results.every((r) => !r.error), results }, null, 2));
  if (!results.every((r) => !r.error)) process.exit(1);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
