import { lookup } from 'node:dns/promises';

function isBlockedIp(ip: string): boolean {
  // IPv4 loopback — full 127.0.0.0/8, not just the literal 127.0.0.1
  if (/^127\./.test(ip)) return true;
  // all-zeros / broadcast
  if (ip === '0.0.0.0') return true;
  // RFC-1918
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  // link-local IPv4 — covers AWS IMDS (169.254.169.254)
  if (/^169\.254\./.test(ip)) return true;
  // CGNAT shared address space
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;

  // IPv6 loopback
  if (ip === '::1') return true;
  // IPv4-mapped (::ffff:x.x.x.x) and IPv4-translated (::ffff:0:x.x.x.x) — both start with ::ffff:
  if (/^::ffff:/i.test(ip)) return true;
  // link-local IPv6 (fe80::/10)
  if (/^fe[89ab][0-9a-f]:/i.test(ip)) return true;
  // ULA IPv6 (fc00::/7 — fc and fd prefixes)
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true;

  return false;
}

export function isAllowedLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const h = parsed.hostname;
    if (h === 'localhost') return false;
    return !isBlockedIp(h);
  } catch {
    return false;
  }
}

// #13 — isAllowedLogoUrl only checks the literal hostname string in the URL.
// A hostname that isn't an IP literal (e.g. an attacker-controlled domain)
// sails through that check and only gets resolved by the OS resolver at
// actual fetch time — DNS rebinding. Call this right before the real fetch
// to catch a hostname that resolves to a blocked address.
export async function resolvesToBlockedIp(hostname: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.some((a) => isBlockedIp(a.address));
  } catch {
    // unresolvable host — fail closed rather than fetch an unknown target
    return true;
  }
}
