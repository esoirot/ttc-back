import { ClientStatus } from './entities/client.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

// FOLLOW_UP_3, TALKING, and CLIENT are intentionally absent — never due in
// this widget. A FOLLOW_UP_3 reaching this same 3-week mark is a separate,
// not-yet-built rule that would move it onto the RECONTACT_LATER cadence.
const PROSPECT_DUE_THRESHOLD_DAYS: Partial<Record<ClientStatus, number>> = {
  [ClientStatus.CONTACTED]: 14,
  [ClientStatus.FOLLOW_UP_1]: 14,
  [ClientStatus.FOLLOW_UP_2]: 14,
  [ClientStatus.RECONTACT_LATER]: 182,
};

export function isProspectDueForContact(
  status: ClientStatus,
  contactedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (status === ClientStatus.TO_CONTACT) return true;

  const thresholdDays = PROSPECT_DUE_THRESHOLD_DAYS[status];
  if (thresholdDays === undefined) return false;
  if (!contactedAt) return true;

  return now.getTime() - contactedAt.getTime() >= thresholdDays * DAY_MS;
}
