export type AdminOwnerModel = {
  id: number;
  email: string;
  name: string | null;
};

export type AdminStatsModel = {
  totalUsers: number;
  totalClients: number;
  totalProjects: number;
  totalInvoices: number;
  totalRevenue: number;
  totalTimeSeconds: number;
};

export type AdminContactModel = {
  id: number;
  clientId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

export type AdminClientModel = {
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
  hubspotId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  contacts: AdminContactModel[];
  owner: AdminOwnerModel;
};

export type AdminProjectModel = {
  id: number;
  userId: number | null;
  clientId: number | null;
  title: string;
  description: string | null;
  status: string;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  wordCount: number | null;
  unitPrice: number | null;
  currency: string;
  deadline: Date | null;
  startDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  owner: AdminOwnerModel | null;
};

export type AdminInvoiceItemModel = {
  id: number;
  invoiceId: number;
  projectId: number | null;
  timeEntryId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type AdminInvoiceModel = {
  id: number;
  userId: number;
  clientId: number | null;
  number: string;
  status: string;
  currency: string;
  issuedAt: Date | null;
  dueDate: Date | null;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: AdminInvoiceItemModel[];
  owner: AdminOwnerModel;
};

export type AdminTimeEntryModel = {
  id: number;
  userId: number;
  projectId: number | null;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  durationSeconds: number | null;
  billable: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: AdminOwnerModel;
};

export type AdminRateModel = {
  id: number;
  userId: number;
  type: string;
  name: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: AdminOwnerModel;
};

export type AdminConnectionModel<T> = {
  items: T[];
  nextCursor: number | null;
  total: number;
};

export type AdminDeleteResultModel = { id: number };
