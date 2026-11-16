/**
 * 服务端专属：Next → Ghostore API 转发（浏览器不直连 Hub，无 CORS）。
 */
export function ghostoreUpstreamBase(): string {
  return (process.env.GHOSTORE_API_URL || 'https://api.ghostore.pw').replace(/\/$/, '');
}

export async function forwardGhostore(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${ghostoreUpstreamBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const upstream = await fetch(url, { ...init, cache: 'no-store' });
  const body = await upstream.text();
  const headers = new Headers();
  const ct = upstream.headers.get('content-type');
  if (ct) headers.set('Content-Type', ct);
  return new Response(body, { status: upstream.status, headers });
}

export function hubArchiveEnabled(): boolean {
  return process.env.VERITHESIS_DISABLE_HUB_ARCHIVE !== '1';
}