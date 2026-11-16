/** Ghostore REST：`error` 常为 `{ code, message }`，顶层也可能有 `message`。 */
export function messageFromGhostoreBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const b = body as Record<string, unknown>;
  if (typeof b.message === 'string' && b.message.trim()) return b.message.trim();
  const err = b.error;
  if (typeof err === 'string' && err.trim()) return err.trim();
  if (err && typeof err === 'object') {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  return fallback;
}

export function apiErrorMessage(status: number, body: unknown, fallback: string): string {
  const msg = messageFromGhostoreBody(body, '');
  if (msg) return msg;
  if (status === 404) {
    return 'Hub 接口未就绪（需 ghostore 迁移 033–035 并完成发布）';
  }
  return fallback || `HTTP ${status}`;
}