export function isAllowedLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const h = parsed.hostname;

    // IPv4 loopback
    if (h === 'localhost' || h === '127.0.0.1') return false;
    // all-zeros / broadcast
    if (h === '0.0.0.0') return false;
    // RFC-1918
    if (/^10\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (/^192\.168\./.test(h)) return false;
    // link-local IPv4 — covers AWS IMDS (169.254.169.254)
    if (/^169\.254\./.test(h)) return false;
    // CGNAT shared address space
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return false;

    // IPv6 loopback
    if (h === '::1') return false;
    // IPv4-mapped (::ffff:x.x.x.x) and IPv4-translated (::ffff:0:x.x.x.x) — both start with ::ffff:
    if (/^::ffff:/i.test(h)) return false;
    // link-local IPv6 (fe80::/10)
    if (/^fe[89ab][0-9a-f]:/i.test(h)) return false;
    // ULA IPv6 (fc00::/7 — fc and fd prefixes)
    if (/^f[cd][0-9a-f]{2}:/i.test(h)) return false;

    return true;
  } catch {
    return false;
  }
}
