import { isAllowedLogoUrl } from './logo-url.util';

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
