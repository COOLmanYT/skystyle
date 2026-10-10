import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const repository = 'COOLmanYT/skystyle';
const environment = 'Preview – skystyle';
const vercelBotId = 35613825;
const isVercel = value => value?.id === vercelBotId && value?.login === 'vercel[bot]';

export function selectPreview(deployments, sha) {
  return deployments.filter(deployment => deployment.sha === sha &&
    deployment.environment === environment && deployment.production_environment === false &&
    isVercel(deployment.creator)).sort((a, b) => b.id - a.id)[0];
}

export function evaluatePreview(statuses) {
  const status = [...statuses].sort((a, b) => b.id - a.id)[0];
  if (!status) return { state: 'pending', reason: 'Preview has no deployment status yet.' };
  if (!isVercel(status.creator) || status.environment !== environment) {
    return { state: 'failed', reason: 'Preview status is not from the Sky Style Vercel integration.' };
  }
  if (['error', 'failure', 'inactive'].includes(status.state)) {
    return { state: 'failed', reason: `Latest Sky Style preview is ${status.state}.` };
  }
  if (status.state !== 'success') return { state: 'pending', reason: 'Preview is not successful yet.' };
  let url;
  try { url = new URL(status.environment_url); } catch {
    return { state: 'failed', reason: 'Successful preview has no valid deployment URL.' };
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
    !/^skystyle-[a-z0-9]+-coolman-co\.vercel\.app$/.test(url.hostname) ||
    url.pathname !== '/' || url.search || url.hash) {
    return { state: 'failed', reason: 'Successful preview URL does not belong to the Sky Style app.' };
  }
  return { state: 'success', url: url.origin, statusId: status.id };
}

export async function checkPreview(sha, { fetchImpl = fetch, token = process.env.GITHUB_TOKEN } = {}) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('A full, lowercase Git commit SHA is required.');
  async function get(path) {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`GitHub preview lookup failed (HTTP ${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('GitHub returned an invalid preview response.');
    return data;
  }
  // GitHub returns deployments newest first. Do not fall back to an older
  // successful attempt when the newest attempt is failed or still building.
  const deployments = await get(`deployments?sha=${sha}&environment=${encodeURIComponent(environment)}&per_page=100`);
  const deployment = selectPreview(deployments, sha);
  if (!deployment) return { state: 'pending', reason: 'No Sky Style preview exists for this commit.' };
  const result = evaluatePreview(await get(`deployments/${deployment.id}/statuses?per_page=100`));
  return { ...result, deploymentId: deployment.id, sha };
}

async function main() {
  const sha = process.argv[2] ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!process.argv[2]) {
    execFileSync('git', ['diff', '--quiet', 'HEAD']);
  }
  const waitSeconds = Number(process.env.PREVIEW_GATE_WAIT_SECONDS ?? 0);
  if (!Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > 900) {
    throw new Error('PREVIEW_GATE_WAIT_SECONDS must be an integer between 0 and 900.');
  }
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    const result = await checkPreview(sha);
    if (result.state === 'success') {
      console.log(`PASS: Sky Style preview for ${sha}: ${result.url} (deployment ${result.deploymentId}).`);
      return;
    }
    if (result.state === 'failed' || Date.now() >= deadline) throw new Error(result.reason);
    console.log(`Waiting for Sky Style preview for ${sha}: ${result.reason}`);
    await new Promise(resolve => setTimeout(resolve, Math.min(15_000, deadline - Date.now())));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`BLOCKED: Vercel preview release gate. ${error.message}`);
    process.exitCode = 1;
  });
}
