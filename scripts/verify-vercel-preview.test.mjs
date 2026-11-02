import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectPreview, evaluatePreview, checkPreview } from './verify-vercel-preview.mjs';

const sha = 'a'.repeat(40);
const creator = { id: 35613825, login: 'vercel[bot]' };
const deployment = { id: 10, sha, creator, environment: 'Preview – skystyle', production_environment: false };
const status = { id: 20, creator, environment: 'Preview – skystyle', state: 'success',
  environment_url: 'https://skystyle-4aphcxukw-coolman-co.vercel.app' };

test('requires the exact commit, app, preview environment and Vercel integration', () => {
  assert.equal(selectPreview([{ ...deployment, sha: 'b'.repeat(40) }], sha), undefined);
  assert.equal(selectPreview([{ ...deployment, environment: 'Preview – skystyle-docs' }], sha), undefined);
  assert.equal(selectPreview([{ ...deployment, production_environment: true }], sha), undefined);
  assert.equal(selectPreview([{ ...deployment, creator: { id: 1, login: 'vercel[bot]' } }], sha), undefined);
  assert.equal(selectPreview([deployment, { ...deployment, id: 11 }], sha).id, 11);
});

test('the latest status must succeed; older successes cannot hide failures or pending work', () => {
  for (const state of ['failure', 'error', 'inactive']) {
    assert.equal(evaluatePreview([status, { ...status, id: 21, state }]).state, 'failed');
  }
  for (const state of ['pending', 'queued', 'in_progress']) {
    assert.equal(evaluatePreview([status, { ...status, id: 21, state }]).state, 'pending');
  }
  assert.equal(evaluatePreview([]).state, 'pending');
  assert.equal(evaluatePreview([status]).state, 'success');
});

test('rejects unrelated URLs and statuses even when marked successful', () => {
  for (const environment_url of [undefined, 'http://skystyle-4aphcxukw-coolman-co.vercel.app',
    'https://skystyle-docs-4aphcxukw-coolman-co.vercel.app', 'https://example.com',
    `${status.environment_url}/login`, `${status.environment_url}?secret=fixture`,
    'https://user:password@skystyle-4aphcxukw-coolman-co.vercel.app']) {
    assert.equal(evaluatePreview([{ ...status, environment_url }]).state, 'failed');
  }
  assert.equal(evaluatePreview([{ ...status, creator: { id: 1 } }]).state, 'failed');
  assert.equal(evaluatePreview([{ ...status, environment: 'Production' }]).state, 'failed');
});

test('reads the newest matching deployment and reports evidence for its commit', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => requests.length === 1
      ? [deployment, { ...deployment, id: 11 }] : [status] };
  };
  const result = await checkPreview(sha, { fetchImpl, token: 'fixture' });
  assert.equal(result.state, 'success');
  assert.equal(result.sha, sha);
  assert.equal(result.deploymentId, 11);
  assert.match(requests[1].url, /deployments\/11\/statuses/);
  assert.equal(requests[0].options.redirect, 'error');
});

test('missing previews, inaccessible APIs and malformed responses never pass', async () => {
  assert.equal((await checkPreview(sha, { fetchImpl: async () => ({ ok: true, json: async () => [] }) })).state, 'pending');
  await assert.rejects(checkPreview(sha, { fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
  await assert.rejects(checkPreview(sha, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /invalid preview/);
  await assert.rejects(checkPreview('main'), /full.*SHA/);
});
