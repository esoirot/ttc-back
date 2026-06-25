export type CompanyContactModel = {
  id: number;
  clientId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
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
  city: string | null;
  country: string | null;
  postalCode: string | null;
  vatNumber: string | null;
  notes: string | null;
  hubspotId: string | null;
  clientType: 'COMPANY' | 'INDIVIDUAL';
  firstName: string | null;
  lastName: string | null;
  paymentDelayDays: number | null;
  taxRate: number | null;
  billingEndOfMonth: boolean;
  website: string | null;
  industry: string | null;
  status:
    | 'TO_CONTACT'
    | 'CONTACTED'
    | 'FOLLOW_UP_1'
    | 'FOLLOW_UP_2'
    | 'FOLLOW_UP_3'
    | 'RECONTACT_LATER'
    | 'TALKING'
    | 'CLIENT';
  contactedAt: Date | null;
  tags: { id: number; name: string }[];
  createdAt: Date;
  updatedAt: Date;
  contacts: CompanyContactModel[];
};
