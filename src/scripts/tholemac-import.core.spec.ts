import {
  normalizeCell,
  parseCompanyRow,
  parseContactRow,
} from './tholemac-import.core';

describe('normalizeCell', () => {
  it('turns the literal "NULL" string into null', () => {
    expect(normalizeCell('NULL')).toBeNull();
  });

  it('turns an empty string into null', () => {
    expect(normalizeCell('')).toBeNull();
  });

  it('trims surrounding whitespace on real values', () => {
    expect(normalizeCell('  Chennai ')).toBe('Chennai');
  });

  it('turns a whitespace-only string into null', () => {
    expect(normalizeCell('   ')).toBeNull();
  });
});

describe('parseCompanyRow', () => {
  const baseRow = {
    id: '2717',
    orga_id: '120',
    prospect: '2',
    activity_sector: '20',
    last_changed_prospect: '2025-12-10 00:00:00',
    type: '2',
    name: 'Side UK Ltd.',
    firstname: 'NULL',
    lastname: 'NULL',
    email: 'NULL',
    address_line1: 'Unit A12, Tileyard London',
    address_line2: "105 Blundell Street - King's Cross",
    postal_code: 'N7 9BN',
    city: 'London',
    country: 'United Kingdom',
    state: 'NULL',
    phone: 'NULL',
    logo: 'NULL',
    payment_deadline: '30',
    payment_deadline_end_month: 'True',
    legal_form: 'NULL',
    website: 'https://www.side.inc/',
    color: '#D2D5DA',
    name_: 'Side UK Ltd.',
    created_at: '2025-08-12 08:03:50.024971',
    updated_at: '2026-04-08 16:18:31.922869',
    deleted_at: 'NULL',
    main_contact_id: 'NULL',
    tax_rate_id: 'NULL',
  };

  it('extracts the legacy id as a number', () => {
    expect(parseCompanyRow(baseRow).legacyId).toBe(2717);
  });

  it('maps recognized columns onto the Client shape', () => {
    expect(parseCompanyRow(baseRow).data).toEqual({
      name: 'Side UK Ltd.',
      email: null,
      address: 'Unit A12, Tileyard London',
      addressLine2: "105 Blundell Street - King's Cross",
      postalCode: 'N7 9BN',
      city: 'London',
      country: 'United Kingdom',
      state: null,
      phone: null,
      paymentDelayDays: 30,
      billingEndOfMonth: true,
      legalForm: null,
      website: 'https://www.side.inc/',
      color: '#D2D5DA',
    });
  });

  it('maps payment_deadline_end_month "NULL" to false', () => {
    const row = { ...baseRow, payment_deadline_end_month: 'NULL' };
    expect(parseCompanyRow(row).data.billingEndOfMonth).toBe(false);
  });

  it('maps a real legal_form value through', () => {
    const row = { ...baseRow, legal_form: 'SAS' };
    expect(parseCompanyRow(row).data.legalForm).toBe('SAS');
  });
});

describe('parseContactRow', () => {
  const baseRow = {
    id: '3819',
    orga_id: '120',
    firstname: 'Rita',
    lastname: 'Pombo',
    email: 'rita.pombo@transperfect.com',
    phone: '+44 20 7061 2000',
    photo: 'NULL',
    job: 'Global Talent Acquisition',
    color: '#D2D5DA',
    created_at: '2025-08-16 16:13:55.011078',
    updated_at: '2025-08-17 14:51:00.3804',
    deleted_at: 'NULL',
    company_id: '2738',
  };

  it('extracts the legacy company id as a number', () => {
    expect(parseContactRow(baseRow).legacyCompanyId).toBe(2738);
  });

  it('maps recognized columns onto the CompanyContact shape', () => {
    expect(parseContactRow(baseRow).data).toEqual({
      firstName: 'Rita',
      lastName: 'Pombo',
      email: 'rita.pombo@transperfect.com',
      phone: '+44 20 7061 2000',
      jobTitle: 'Global Talent Acquisition',
      color: '#D2D5DA',
    });
  });
});
