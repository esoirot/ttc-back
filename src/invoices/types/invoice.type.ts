export type InvoiceItemModel = {
  id: number;
  invoiceId: number;
  projectId: number | null;
  timeEntryId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoiceModel = {
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
  items?: InvoiceItemModel[];
};
