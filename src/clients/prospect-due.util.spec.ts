import { ClientStatus } from './entities/client.entity';
import { isProspectDueForContact } from './prospect-due.util';

const NOW = new Date('2026-06-19T00:00:00.000Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe('isProspectDueForContact', () => {
  it('TO_CONTACT is always due, regardless of contactedAt', () => {
    expect(isProspectDueForContact(ClientStatus.TO_CONTACT, null, NOW)).toBe(
      true,
    );
    expect(
      isProspectDueForContact(ClientStatus.TO_CONTACT, daysAgo(0), NOW),
    ).toBe(true);
  });

  describe.each([
    ClientStatus.CONTACTED,
    ClientStatus.FOLLOW_UP_1,
    ClientStatus.FOLLOW_UP_2,
  ])('%s (2 week threshold)', (status) => {
    it('not due just under 14 days', () => {
      expect(isProspectDueForContact(status, daysAgo(13), NOW)).toBe(false);
    });

    it('due at exactly 14 days', () => {
      expect(isProspectDueForContact(status, daysAgo(14), NOW)).toBe(true);
    });

    it('due well over 14 days', () => {
      expect(isProspectDueForContact(status, daysAgo(30), NOW)).toBe(true);
    });

    it('treats missing contactedAt as overdue', () => {
      expect(isProspectDueForContact(status, null, NOW)).toBe(true);
    });
  });

  describe('RECONTACT_LATER (6 month / 182 day threshold)', () => {
    it('not due just under 182 days', () => {
      expect(
        isProspectDueForContact(
          ClientStatus.RECONTACT_LATER,
          daysAgo(181),
          NOW,
        ),
      ).toBe(false);
    });

    it('due at exactly 182 days', () => {
      expect(
        isProspectDueForContact(
          ClientStatus.RECONTACT_LATER,
          daysAgo(182),
          NOW,
        ),
      ).toBe(true);
    });

    it('due well over 182 days', () => {
      expect(
        isProspectDueForContact(
          ClientStatus.RECONTACT_LATER,
          daysAgo(400),
          NOW,
        ),
      ).toBe(true);
    });

    it('treats missing contactedAt as overdue', () => {
      expect(
        isProspectDueForContact(ClientStatus.RECONTACT_LATER, null, NOW),
      ).toBe(true);
    });
  });

  describe.each([
    ClientStatus.FOLLOW_UP_3,
    ClientStatus.TALKING,
    ClientStatus.CLIENT,
  ])('%s — never due in this widget', (status) => {
    it('not due even with a very old contactedAt', () => {
      expect(isProspectDueForContact(status, daysAgo(1000), NOW)).toBe(false);
    });

    it('not due with null contactedAt', () => {
      expect(isProspectDueForContact(status, null, NOW)).toBe(false);
    });
  });
});
