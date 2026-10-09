import { ClientStatus } from './entities/client.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

// TALKING and CLIENT are intentionally absent — never due in this widget.
// A FOLLOW_UP_2 reaching the 3-week mark is moved to RECONTACT_LATER by
// ProspectCronService instead.
const PROSPECT_DUE_THRESHOLD_DAYS: Partial<Record<ClientStatus, number>> = {
  [ClientStatus.CONTACTED]: 14,
  [ClientStatus.FOLLOW_UP_1]: 14,
  [ClientStatus.FOLLOW_UP_2]: 14,
  [ClientStatus.RECONTACT_LATER]: 182,
};

const ALWAYS_DUE = new Set([
  ClientStatus.TO_CONTACT,
  ClientStatus.FORMER_CLIENT,
]);

/** Where a prospect goes when a newer contact date is logged. */
const NEXT_STATUS_AFTER_CONTACT: Partial<Record<ClientStatus, ClientStatus>> = {
  [ClientStatus.TO_CONTACT]: ClientStatus.CONTACTED,
  [ClientStatus.FORMER_CLIENT]: ClientStatus.CONTACTED,
  [ClientStatus.CONTACTED]: ClientStatus.FOLLOW_UP_1,
  [ClientStatus.FOLLOW_UP_1]: ClientStatus.FOLLOW_UP_2,
  [ClientStatus.FOLLOW_UP_2]: ClientStatus.RECONTACT_LATER,
  [ClientStatus.RECONTACT_LATER]: ClientStatus.CONTACTED,
};

/** The date prospect waits count from: the newer of the two, if any. */
export function newestContactDate(
  contactedAt: Date | null,
  toRecontactAt: Date | null,
): Date | null {
  if (!contactedAt || !toRecontactAt) return contactedAt ?? toRecontactAt;
  return contactedAt > toRecontactAt ? contactedAt : toRecontactAt;
}

export function nextStatusAfterContact(
  status: ClientStatus,
): ClientStatus | null {
  return NEXT_STATUS_AFTER_CONTACT[status] ?? null;
}

/**
 * When a prospect needs contacting: null = now (always-due status, or no
 * date yet), undefined = never (not a prospect status).
 */
export function prospectDueAt(
  status: ClientStatus,
  lastContact: Date | null,
): Date | null | undefined {
  if (ALWAYS_DUE.has(status)) return null;
  const thresholdDays = PROSPECT_DUE_THRESHOLD_DAYS[status];
  if (thresholdDays === undefined) return undefined;
  if (!lastContact) return null;
  return new Date(lastContact.getTime() + thresholdDays * DAY_MS);
}
