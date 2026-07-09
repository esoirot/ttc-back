/**
 * Model order for full-DB export/import, parents before children per FK deps
 * in prisma/schema.prisma. New model? Add it here in dependency order too.
 */
export const MODEL_ORDER = [
  'User',
  'Client',
  'Activity',
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
  'RateSheet',
] as const;

export function toClientProperty(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}
