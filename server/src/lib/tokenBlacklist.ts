// In-memory token blacklist — upgrade to Redis in production
// Key: token string  Value: expiry timestamp (ms)
const blacklist = new Map<string, number>();

export function revokeToken(token: string, expiresAtMs: number): void {
  blacklist.set(token, expiresAtMs);
}

export function isTokenRevoked(token: string): boolean {
  const expiry = blacklist.get(token);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) {
    blacklist.delete(token);
    return false;
  }
  return true;
}

// Purge expired entries every 30 minutes to cap memory usage
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of blacklist) {
    if (now > expiry) blacklist.delete(token);
  }
}, 30 * 60 * 1000).unref();
