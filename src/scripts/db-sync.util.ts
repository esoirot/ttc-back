/**
 * Model order for full-DB export/import, parents before children per FK deps
 * in prisma/schema.prisma. New model? Add it here in dependency order too.
 */
export const MODEL_ORDER = [
  'User',
  'Client',
  'Occupation',
  'ClientOccupation',
  'ClientStatusHistory',
  'RateSheet',
  'CompanyContact',
  'Project',
  'ProjectOccupation',
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

/**
 * Composite-key models with no `id` field — export order must use their PK
 * fields instead. Prisma rejects a single multi-key object for composite
 * orderBy; each field must be its own object in an array.
 */
const MODEL_ORDER_BY: Record<string, Record<string, 'asc'>[]> = {
  TimeEntryTag: [{ timeEntryId: 'asc' }, { tagId: 'asc' }],
  ClientTag: [{ clientId: 'asc' }, { tagId: 'asc' }],
  ClientOccupation: [{ clientId: 'asc' }, { occupationId: 'asc' }],
  ProjectOccupation: [{ projectId: 'asc' }, { occupationId: 'asc' }],
};

export function orderByFor(
  modelName: string,
): Record<string, 'asc'> | Record<string, 'asc'>[] {
  return MODEL_ORDER_BY[modelName] ?? { id: 'asc' };
}

/** False for composite-key join tables: they have no `id` column and no sequence to reset. */
export function hasSerialId(modelName: string): boolean {
  return !(modelName in MODEL_ORDER_BY);
}
