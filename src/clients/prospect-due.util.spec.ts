import { ClientStatus } from './entities/client.entity';
import {
  newestContactDate,
  nextStatusAfterContact,
  prospectDueAt,
} from './prospect-due.util';

const NOW = new Date('2026-06-19T00:00:00.000Z');
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

describe('prospectDueAt', () => {
  it.each([ClientStatus.TO_CONTACT, ClientStatus.FORMER_CLIENT])(
    '%s is due now (null), whatever the date',
    (status) => {
      expect(prospectDueAt(status, null)).toBeNull();
      expect(prospectDueAt(status, daysAgo(0))).toBeNull();
    },
  );

  it.each([
    ClientStatus.CONTACTED,
    ClientStatus.FOLLOW_UP_1,
    ClientStatus.FOLLOW_UP_2,
  ])('%s is due 14 days after the last contact', (status) => {
    expect(prospectDueAt(status, daysAgo(20))).toEqual(daysAgo(6));
  });

  it('RECONTACT_LATER is due 182 days after the last contact', () => {
    expect(prospectDueAt(ClientStatus.RECONTACT_LATER, daysAgo(100))).toEqual(
      daysAgo(-82),
    );
  });

  it.each([
    ClientStatus.CONTACTED,
    ClientStatus.FOLLOW_UP_1,
    ClientStatus.FOLLOW_UP_2,
    ClientStatus.RECONTACT_LATER,
  ])('%s without a date is due now (null)', (status) => {
    expect(prospectDueAt(status, null)).toBeNull();
  });

  it.each([ClientStatus.TALKING, ClientStatus.CLIENT])(
    '%s is never due (undefined)',
    (status) => {
      expect(prospectDueAt(status, daysAgo(1000))).toBeUndefined();
      expect(prospectDueAt(status, null)).toBeUndefined();
    },
  );
});

describe('newestContactDate', () => {
  it('is the newer of contactedAt and toRecontactAt', () => {
    expect(newestContactDate(daysAgo(30), daysAgo(5))).toEqual(daysAgo(5));
    expect(newestContactDate(daysAgo(5), daysAgo(30))).toEqual(daysAgo(5));
  });

  it('uses whichever date is set', () => {
    expect(newestContactDate(daysAgo(3), null)).toEqual(daysAgo(3));
    expect(newestContactDate(null, daysAgo(3))).toEqual(daysAgo(3));
  });

  it('is null when neither date is set', () => {
    expect(newestContactDate(null, null)).toBeNull();
  });
});

describe('nextStatusAfterContact', () => {
  it.each([
    [ClientStatus.TO_CONTACT, ClientStatus.CONTACTED],
    [ClientStatus.FORMER_CLIENT, ClientStatus.CONTACTED],
    [ClientStatus.CONTACTED, ClientStatus.FOLLOW_UP_1],
    [ClientStatus.FOLLOW_UP_1, ClientStatus.FOLLOW_UP_2],
    [ClientStatus.FOLLOW_UP_2, ClientStatus.RECONTACT_LATER],
    [ClientStatus.RECONTACT_LATER, ClientStatus.CONTACTED],
  ])('%s moves to %s', (from, to) => {
    expect(nextStatusAfterContact(from)).toBe(to);
  });

  it.each([ClientStatus.TALKING, ClientStatus.CLIENT])(
    '%s does not move',
    (status) => {
      expect(nextStatusAfterContact(status)).toBeNull();
    },
  );
});
