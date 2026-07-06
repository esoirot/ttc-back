import { isAllowedLogoUrl, resolvesToBlockedIp } from './logo-url.util';

jest.mock('node:dns/promises');
import { lookup } from 'node:dns/promises';
const mockLookup = lookup as jest.MockedFunction<typeof lookup>;

describe('isAllowedLogoUrl', () => {
  describe('valid URLs', () => {
    it('allows public HTTPS URL', () => {
      expect(isAllowedLogoUrl('https://example.com/logo.png')).toBe(true);
    });

    it('allows HTTPS with subdomain', () => {
      expect(isAllowedLogoUrl('https://cdn.example.com/logo.png')).toBe(true);
    });

    it('allows HTTPS with path and query', () => {
      expect(isAllowedLogoUrl('https://example.com/img/logo.png?v=2')).toBe(
        true,
      );
    });
  });

  describe('blocked protocols', () => {
    it('blocks http://', () => {
      expect(isAllowedLogoUrl('http://example.com/logo.png')).toBe(false);
    });

    it('blocks ftp://', () => {
      expect(isAllowedLogoUrl('ftp://example.com/logo.png')).toBe(false);
    });

    it('blocks data: URIs', () => {
      expect(isAllowedLogoUrl('data:image/png;base64,abc')).toBe(false);
    });
  });

  describe('blocked private/loopback IPv4', () => {
    it('blocks localhost', () => {
      expect(isAllowedLogoUrl('https://localhost/logo.png')).toBe(false);
    });

    it('blocks 127.0.0.1', () => {
      expect(isAllowedLogoUrl('https://127.0.0.1/logo.png')).toBe(false);
    });

    it('blocks the full 127.0.0.0/8 loopback range, not just 127.0.0.1 (#13)', () => {
      expect(isAllowedLogoUrl('https://127.0.0.2/logo.png')).toBe(false);
      expect(isAllowedLogoUrl('https://127.255.255.255/logo.png')).toBe(false);
    });

    it('does NOT block 126.255.255.255 (just below the loopback range)', () => {
      expect(isAllowedLogoUrl('https://126.255.255.255/logo.png')).toBe(true);
    });

    it('blocks 0.0.0.0', () => {
      expect(isAllowedLogoUrl('https://0.0.0.0/logo.png')).toBe(false);
    });

    it('blocks 10.x.x.x (private)', () => {
      expect(isAllowedLogoUrl('https://10.0.0.1/logo.png')).toBe(false);
    });

    it('blocks 172.16.x.x (private)', () => {
      expect(isAllowedLogoUrl('https://172.16.0.1/logo.png')).toBe(false);
    });

    it('blocks 172.31.x.x (private)', () => {
      expect(isAllowedLogoUrl('https://172.31.255.255/logo.png')).toBe(false);
    });

    it('does NOT block 172.32.x.x (public)', () => {
      expect(isAllowedLogoUrl('https://172.32.0.1/logo.png')).toBe(true);
    });

    it('blocks 192.168.x.x (private)', () => {
      expect(isAllowedLogoUrl('https://192.168.1.1/logo.png')).toBe(false);
    });

    it('blocks 169.254.x.x (link-local)', () => {
      expect(isAllowedLogoUrl('https://169.254.0.1/logo.png')).toBe(false);
    });

    it('blocks 100.64.x.x (CGNAT)', () => {
      expect(isAllowedLogoUrl('https://100.64.0.1/logo.png')).toBe(false);
    });

    it('blocks 100.127.x.x (CGNAT)', () => {
      expect(isAllowedLogoUrl('https://100.127.255.255/logo.png')).toBe(false);
    });

    it('does NOT block 100.128.x.x (public)', () => {
      expect(isAllowedLogoUrl('https://100.128.0.1/logo.png')).toBe(true);
    });
  });

  describe('invalid input', () => {
    it('returns false for empty string', () => {
      expect(isAllowedLogoUrl('')).toBe(false);
    });

    it('returns false for non-URL string', () => {
      expect(isAllowedLogoUrl('not a url')).toBe(false);
    });

    it('returns false for relative path', () => {
      expect(isAllowedLogoUrl('/logo.png')).toBe(false);
    });
  });
});

describe('resolvesToBlockedIp', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when the hostname resolves only to public addresses', async () => {
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ] as never);
    expect(await resolvesToBlockedIp('example.com')).toBe(false);
  });

  it('returns true when the hostname resolves to a blocked address (DNS rebinding, #13)', async () => {
    mockLookup.mockResolvedValue([
      { address: '127.0.0.1', family: 4 },
    ] as never);
    expect(await resolvesToBlockedIp('attacker-controlled.example')).toBe(true);
  });

  it('returns true when any of several resolved addresses is blocked', async () => {
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ] as never);
    expect(await resolvesToBlockedIp('multi-a-record.example')).toBe(true);
  });

  it('fails closed when the hostname cannot be resolved', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    expect(await resolvesToBlockedIp('nonexistent.invalid')).toBe(true);
  });
});
