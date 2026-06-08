import { TranslationRateModel } from '../../translation-rates/types/translation-rate.type';

export interface ChargeModel {
  id: number;
  activityId: number;
  name: string;
  amount: number;
  type: string;
}

interface LanguagePairModel {
  id: number;
  activityId: number;
  fromLanguage: string;
  toLanguage: string;
}

interface CustomFieldModel {
  id: number;
  activityId: number;
  key: string;
  value: string;
}

export interface ActivityModel {
  id: number;
  userId: number;
  name: string;
  activityType: string;
  companyName: string | null;
  legalForm: string | null;
  professionalEmail: string | null;
  professionalPhone: string | null;
  website: string | null;
  timezone: string | null;
  objectiveQ1: number | null;
  objectiveQ2: number | null;
  objectiveQ3: number | null;
  objectiveQ4: number | null;
  charges: ChargeModel[];
  translationRates: TranslationRateModel[];
  languagePairs: LanguagePairModel[];
  customFields: CustomFieldModel[];
  createdAt: Date;
  updatedAt: Date;
}
