export interface TranslationRateModel {
  id: number;
  userId: number;
  clientId: number | null;
  type: string;
  name: string;
  amount: number;
  currency: string;
  description: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
