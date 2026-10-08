import { TranslationRateModel } from '../../translation-rates/types/translation-rate.type';

export interface ChargeModel {
  id: number;
  occupationId: number;
  name: string;
  amount: number;
  type: string;
}

interface LanguagePairModel {
  id: number;
  occupationId: number;
  fromLanguage: string;
  toLanguage: string;
}

interface CustomFieldModel {
  id: number;
  occupationId: number;
  key: string;
  value: string;
}

/** An occupation row without its nested lists. */
export type OccupationRow = Omit<
  OccupationModel,
  'charges' | 'translationRates' | 'languagePairs' | 'customFields'
>;

export interface OccupationModel {
  id: number;
  userId: number;
  name: string;
  occupationType: string;
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
