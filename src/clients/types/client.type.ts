import type { OccupationRow } from '../../occupations/types/occupation.type';

export type CompanyContactModel = {
  id: number;
  clientId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientModel = {
  id: number;
  userId: number;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  addressLine2: string | null;
  city: string | null;
  country: string | null;
  state: string | null;
  postalCode: string | null;
  vatNumber: string | null;
  legalForm: string | null;
  color: string | null;
  notes: string | null;
  hubspotId: string | null;
  clientType: 'COMPANY' | 'INDIVIDUAL';
  firstName: string | null;
  lastName: string | null;
  paymentDelayDays: number | null;
  taxRate: number | null;
  billingEndOfMonth: boolean;
  website: string | null;
  linkedinUrl: string | null;
  industry: string | null;
  status:
    | 'TO_CONTACT'
    | 'CONTACTED'
    | 'FOLLOW_UP_1'
    | 'FOLLOW_UP_2'
    | 'RECONTACT_LATER'
    | 'TALKING'
    | 'CLIENT'
    | 'FORMER_CLIENT';
  contactedAt: Date | null;
  toRecontactAt: Date | null;
  tags: { id: number; name: string }[];
  createdAt: Date;
  updatedAt: Date;
  contacts: CompanyContactModel[];
  occupations: OccupationRow[];
};
