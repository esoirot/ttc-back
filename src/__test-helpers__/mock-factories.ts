import type { AuthUser } from '../auth/types/auth-user.type';
import type { ProjectModel } from '../projects/types/project.type';
import type { TaskModel } from '../tasks/types/task.type';
import type { InvoiceModel } from '../invoices/types/invoice.type';
import type { TimeEntryModel } from '../time-entries/types/time-entry.type';
import type { ClientModel } from '../clients/types/client.type';
import type { TagModel } from '../tags/types/tag.type';
import type { RateSheetModel } from '../rate-sheets/types/rate-sheet.type';
import type { TranslationRateModel } from '../translation-rates/types/translation-rate.type';
import type { ClientRateModel } from '../client-rates/types/client-rate.type';

const now = new Date('2024-01-01T00:00:00Z');

export function mockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    email: 'user@example.com',
    name: 'Test User',
    password: '$2b$12$hashedpassword',
    role: 'USER',
    twoFactorSecret: null,
    twoFactorEnabled: false,
    ...overrides,
  };
}

export function mockProject(
  overrides: Partial<ProjectModel> = {},
): ProjectModel {
  return {
    id: 1,
    userId: 1,
    clientId: null,
    title: 'Test Project',
    description: null,
    status: 'IN_PROGRESS',
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    wordCount: null,
    unitPrice: null,
    fixedFee: null,
    hourlyRate: null,
    perWordRate: null,
    currency: 'EUR',
    deadline: null,
    startDate: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function mockTask(overrides: Partial<TaskModel> = {}): TaskModel {
  return {
    id: 1,
    projectId: 1,
    assigneeId: null,
    title: 'Test Task',
    description: null,
    status: 'TODO',
    dueDate: null,
    sortOrder: 0,
    checklistTitles: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function mockInvoice(
  overrides: Partial<InvoiceModel> = {},
): InvoiceModel {
  return {
    id: 1,
    userId: 1,
    clientId: null,
    number: 'INV-001',
    status: 'DRAFT',
    currency: 'EUR',
    issuedAt: null,
    dueDate: null,
    paidAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    items: [],
    ...overrides,
  };
}

export function mockTimeEntry(
  overrides: Partial<TimeEntryModel> = {},
): TimeEntryModel {
  return {
    id: 1,
    userId: 1,
    projectId: null,
    description: null,
    startTime: now,
    endTime: null,
    durationSeconds: null,
    billable: false,
    clockifyEntryId: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function mockClient(overrides: Partial<ClientModel> = {}): ClientModel {
  return {
    id: 1,
    userId: 1,
    name: 'Test Client',
    legalName: null,
    email: null,
    phone: null,
    company: null,
    address: null,
    city: null,
    country: null,
    postalCode: null,
    vatNumber: null,
    notes: null,
    hubspotId: null,
    clientType: 'INDIVIDUAL',
    firstName: null,
    lastName: null,
    paymentDelayDays: null,
    taxRate: null,
    billingEndOfMonth: false,
    website: null,
    industry: null,
    status: 'CLIENT',
    contactedAt: null,
    tags: [],
    contacts: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function mockTag(overrides: Partial<TagModel> = {}): TagModel {
  return {
    id: 1,
    userId: 1,
    name: 'Test Tag',
    createdAt: now,
    ...overrides,
  };
}

export function mockRateSheet(
  overrides: Partial<RateSheetModel> = {},
): RateSheetModel {
  return {
    id: 1,
    userId: 1,
    activityId: null,
    clientId: null,
    name: 'Standard Rate Sheet',
    description: null,
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    currency: 'EUR',
    pricePerWord: 0.1,
    matchRates: {
      perfectMatch: 0,
      cm: 0.1,
      repetitions: 0.3,
      repetitionsBetweenFiles: 0.3,
      match100: 0,
      match95_99: 0.2,
      match85_94: 0.5,
      match75_84: 0.7,
      match50_74: 0.85,
      referenceAdaptativeMT: 0.7,
      adaptativeMTWithLearning: 0.7,
      newWordsTA: 1,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function mockTranslationRate(
  overrides: Partial<TranslationRateModel> = {},
): TranslationRateModel {
  return {
    id: 1,
    userId: 1,
    activityId: null,
    clientId: null,
    type: 'PER_WORD',
    name: 'Standard Rate',
    amount: 0.1,
    currency: 'EUR',
    description: null,
    sourceLanguage: null,
    targetLanguage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function mockClientRate(
  overrides: Partial<ClientRateModel> = {},
): ClientRateModel {
  return {
    id: 1,
    clientId: 1,
    userId: 1,
    type: 'PER_WORD',
    name: 'Client Rate',
    amount: 0.12,
    currency: 'EUR',
    description: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function mockFastifyReply() {
  return {
    setCookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}
