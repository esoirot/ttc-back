export interface MatchRatesModel {
  perfectMatch: number;
  cm: number;
  repetitions: number;
  repetitionsBetweenFiles: number;
  match100: number;
  match95_99: number;
  match85_94: number;
  match75_84: number;
  match50_74: number;
  referenceAdaptativeMT: number;
  adaptativeMTWithLearning: number;
  newWordsTA: number;
}

export interface RateSheetModel {
  id: number;
  userId: number;
  activityId: number | null;
  clientId: number | null;
  name: string;
  description: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  currency: string;
  pricePerWord: number;
  matchRates: MatchRatesModel;
  createdAt: Date;
  updatedAt: Date;
}
