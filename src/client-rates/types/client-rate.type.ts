export interface ClientRateModel {
  id: number;
  clientId: number;
  userId: number;
  type: string;
  name: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
