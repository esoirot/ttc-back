export type CsvRow = Record<string, string>;

interface TholemacClientData {
  name: string;
  email: string | null;
  address: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  state: string | null;
  phone: string | null;
  paymentDelayDays: number | null;
  billingEndOfMonth: boolean;
  legalForm: string | null;
  website: string | null;
  color: string | null;
}

interface TholemacContactData {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  color: string | null;
}

/** Tholemac exports use the literal string "NULL" for empty cells; also collapses blank/whitespace-only cells. */
export function normalizeCell(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' || trimmed === 'NULL' ? null : trimmed;
}

function normalizeInt(value: string): number | null {
  const cell = normalizeCell(value);
  return cell === null ? null : parseInt(cell, 10);
}

export function parseCompanyRow(row: CsvRow): {
  legacyId: number;
  data: TholemacClientData;
} {
  return {
    legacyId: Number(row.id),
    data: {
      name: normalizeCell(row.name) ?? row.name,
      email: normalizeCell(row.email),
      address: normalizeCell(row.address_line1),
      addressLine2: normalizeCell(row.address_line2),
      postalCode: normalizeCell(row.postal_code),
      city: normalizeCell(row.city),
      country: normalizeCell(row.country),
      state: normalizeCell(row.state),
      phone: normalizeCell(row.phone),
      paymentDelayDays: normalizeInt(row.payment_deadline),
      billingEndOfMonth:
        normalizeCell(row.payment_deadline_end_month) === 'True',
      legalForm: normalizeCell(row.legal_form),
      website: normalizeCell(row.website),
      color: normalizeCell(row.color),
    },
  };
}

export function parseContactRow(row: CsvRow): {
  legacyCompanyId: number;
  data: TholemacContactData;
} {
  return {
    legacyCompanyId: Number(row.company_id),
    data: {
      firstName: normalizeCell(row.firstname),
      lastName: normalizeCell(row.lastname),
      email: normalizeCell(row.email),
      phone: normalizeCell(row.phone),
      jobTitle: normalizeCell(row.job),
      color: normalizeCell(row.color),
    },
  };
}
