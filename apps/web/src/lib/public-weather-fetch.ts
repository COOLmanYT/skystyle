import dns from 'node:dns/promises';
import { request } from 'node:https';
import { checkServerIdentity } from 'node:tls';
import ipaddr from 'ipaddr.js';
import type { LookupAddress } from 'node:dns';

const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_CACHE_BYTES = 2_097_152;
const cache = new Map<string,{body:Uint8Array<ArrayBuffer>;contentType:string;expires:number}>();
let cacheBytes = 0;
function evict(key:string) { const entry=cache.get(key); if(entry)cacheBytes-=entry.body.length; cache.delete(key); }
export function isPublicWeatherAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === 'unicast'; }
  catch { return false; }
}

/** Custom sources may use any public HTTPS host, but never a second DNS result. */
export async function fetchPublicWeatherUrl(input: string, signal: AbortSignal, revalidate = 0): Promise<Response> {
  signal.throwIfAborted();
  if(input.length>8192)throw new Error('Custom weather URL is too long.');
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Custom weather sources require public HTTPS on port 443 without credentials.');
  }
  const cached=cache.get(url.href);
  if(revalidate>0 && cached && cached.expires>Date.now())return new Response(cached.body.slice(),{headers:{'Content-Type':cached.contentType}});
  if(cached && cached.expires<=Date.now())evict(url.href);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await new Promise<LookupAddress[]>((resolve,reject)=>{
    const aborted=()=>reject(signal.reason);
    signal.addEventListener('abort',aborted,{once:true});
    dns.lookup(hostname,{all:true}).then(result=>{
      signal.removeEventListener('abort',aborted);resolve(result);
    },error=>{signal.removeEventListener('abort',aborted);reject(error);});
  });
  if (!addresses.length || addresses.some(value => !isPublicWeatherAddress(value.address))) {
    throw new Error('Custom weather source must resolve only to public IP addresses.');
  }
  signal.throwIfAborted();
  const address = addresses.find(value => value.family === 4) ?? addresses[0];
  return new Promise<Response>((resolve, reject) => {
    // Connect directly to the validated IP. Host and certificate validation still
    // use the original hostname; redirects are deliberately never followed.
    const req = request({
      protocol: 'https:', hostname: address.address, family: address.family, port: 443,
      servername: ipaddr.isValid(hostname) ? undefined : hostname,
      checkServerIdentity: (_host, certificate) => checkServerIdentity(hostname, certificate),
      path: url.pathname + url.search, method: 'GET', signal,
      headers: { Host: url.host, 'User-Agent': 'SkyStyle/1.0 (weather-stylist app)', Accept: 'application/json, application/rss+xml, text/xml' },
    }, response => {
      if (!response.statusCode || response.statusCode >= 300 && response.statusCode < 400) {
        response.destroy(); reject(new Error('Custom weather redirects are not allowed.')); return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('error', reject);
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_RESPONSE_BYTES) response.destroy(new Error('Custom weather response is too large.'));
        else chunks.push(chunk);
      });
      response.on('end', () => {
        try {
          const body=new Uint8Array(Buffer.concat(chunks));
          const contentType=response.headers['content-type'] ?? 'application/octet-stream';
          if(response.statusCode===200 && Number.isFinite(revalidate) && revalidate>0) {
            for(const [key,entry] of cache)if(entry.expires<=Date.now())evict(key);
            evict(url.href);
            while(cache.size && (cache.size>=32 || cacheBytes+body.length>MAX_CACHE_BYTES))evict(cache.keys().next().value!);
            cache.set(url.href,{body,contentType,expires:Date.now()+Math.min(revalidate,600)*1000});cacheBytes+=body.length;
          }
          resolve(new Response(response.statusCode === 204 || response.statusCode === 205 ? null : body.slice(), {
            status: response.statusCode,
            headers: { 'Content-Type': contentType },
          }));
        } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}
