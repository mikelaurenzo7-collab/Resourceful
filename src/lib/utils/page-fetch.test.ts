import { describe, expect, it } from 'vitest';
import {
  fetchPageText,
  isBlockedHostname,
  isPrivateOrReservedIp,
} from './page-fetch';

describe('public page fetch security boundaries', () => {
  describe('isBlockedHostname', () => {
    it.each([
      'localhost',
      'api.localhost',
      'printer.local',
      'metadata.internal',
      'service.home.arpa',
      'LOCALHOST.',
    ])('blocks local or internal hostname %s', (hostname) => {
      expect(isBlockedHostname(hostname)).toBe(true);
    });

    it.each([
      'example.com',
      'www.cookcountyassessor.com',
      'county.gov',
    ])('allows ordinary public hostname %s', (hostname) => {
      expect(isBlockedHostname(hostname)).toBe(false);
    });
  });

  describe('isPrivateOrReservedIp', () => {
    it.each([
      '0.0.0.0',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.0.0.1',
      '192.0.2.10',
      '192.88.99.1',
      '192.168.1.1',
      '198.18.0.1',
      '198.51.100.10',
      '203.0.113.10',
      '224.0.0.1',
      '255.255.255.255',
    ])('blocks private or reserved IPv4 address %s', (address) => {
      expect(isPrivateOrReservedIp(address)).toBe(true);
    });

    it.each([
      '8.8.8.8',
      '1.1.1.1',
      '93.184.216.34',
    ])('allows ordinary public IPv4 address %s', (address) => {
      expect(isPrivateOrReservedIp(address)).toBe(false);
    });

    it.each([
      '::',
      '::1',
      'fc00::1',
      'fd00::1',
      'fe80::1',
      'ff02::1',
      '2001:db8::1',
      '::ffff:127.0.0.1',
    ])('blocks private or reserved IPv6 address %s', (address) => {
      expect(isPrivateOrReservedIp(address)).toBe(true);
    });

    it.each([
      '2606:4700:4700::1111',
      '2001:4860:4860::8888',
    ])('allows ordinary public IPv6 address %s', (address) => {
      expect(isPrivateOrReservedIp(address)).toBe(false);
    });

    it('treats malformed addresses as unsafe', () => {
      expect(isPrivateOrReservedIp('not-an-ip')).toBe(true);
    });
  });

  describe('fetchPageText input validation', () => {
    it.each([
      'javascript:alert(1)',
      'file:///etc/passwd',
      'http://localhost/admin',
      'http://api.internal/metadata',
      'http://user:password@example.com/private',
    ])('rejects unsafe URL %s without a network request', async (url) => {
      await expect(fetchPageText(url)).resolves.toBeNull();
    });
  });
});
