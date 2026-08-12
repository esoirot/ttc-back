/**
 * Model order for full-DB export/import, parents before children per FK deps
 * in prisma/schema.prisma. New model? Add it here in dependency order too.
 */
export const MODEL_ORDER = [
  'User',
  'Client',
  'Activity',
  'RateSheet',
  'CompanyContact',
  'Project',
  'Tag',
  'Task',
  'Subtask',
  'TaskComment',
  'TaskLabel',
  'TaskAttachment',
  'TimeEntry',
  'TaskActivity',
  'TimeEntryTag',
  'ClientTag',
  'Invoice',
  'InvoiceItem',
  'RefreshToken',
  'PasswordResetToken',
  'OAuthAccount',
  'AuditLog',
  'TwoFactorBackupCode',
  'TranslationRate',
  'ClientRate',
  'Charge',
  'LanguagePair',
  'CustomField',
] as const;

export function toClientProperty(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/** Composite-key models with no `id` field — export order must use their PK fields instead. */
const MODEL_ORDER_BY: Record<string, Record<string, 'asc'>> = {
  TimeEntryTag: { timeEntryId: 'asc', tagId: 'asc' },
  ClientTag: { clientId: 'asc', tagId: 'asc' },
};

export function orderByFor(modelName: string): Record<string, 'asc'> {
  return MODEL_ORDER_BY[modelName] ?? { id: 'asc' };
}
