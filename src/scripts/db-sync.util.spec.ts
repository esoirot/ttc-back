import { MODEL_ORDER, toClientProperty } from './db-sync.util';

// [model, ...modelsItDependsOn] per FK fields in prisma/schema.prisma
const FK_DEPENDENCIES: [string, string[]][] = [
  ['Client', ['User']],
  ['Activity', ['User']],
  ['CompanyContact', ['Client']],
  ['Project', ['User', 'Client', 'RateSheet']],
  ['Tag', ['User']],
  ['Task', ['Project', 'User']],
  ['Subtask', ['Task']],
  ['TaskComment', ['Task', 'User']],
  ['TaskLabel', ['Task']],
  ['TaskAttachment', ['Task']],
  ['TimeEntry', ['User', 'Project', 'Task', 'Subtask']],
  ['TaskActivity', ['Task', 'TimeEntry', 'User']],
  ['TimeEntryTag', ['TimeEntry', 'Tag']],
  ['ClientTag', ['Client', 'Tag']],
  ['Invoice', ['User', 'Client']],
  ['InvoiceItem', ['Invoice', 'Project', 'TimeEntry']],
  ['RefreshToken', ['User']],
  ['PasswordResetToken', ['User']],
  ['OAuthAccount', ['User']],
  ['AuditLog', ['User']],
  ['TwoFactorBackupCode', ['User']],
  ['TranslationRate', ['User', 'Activity', 'Client']],
  ['ClientRate', ['Client', 'User']],
  ['Charge', ['Activity']],
  ['LanguagePair', ['Activity']],
  ['CustomField', ['Activity']],
  ['RateSheet', ['User', 'Activity', 'Client']],
];

describe('MODEL_ORDER', () => {
  it('lists every model exactly once', () => {
    expect(new Set(MODEL_ORDER).size).toBe(MODEL_ORDER.length);
  });

  it('includes every model referenced in FK_DEPENDENCIES', () => {
    for (const [model, deps] of FK_DEPENDENCIES) {
      expect(MODEL_ORDER).toContain(model);
      for (const dep of deps) {
        expect(MODEL_ORDER).toContain(dep);
      }
    }
  });

  it('places every model after all models it has an FK to', () => {
    const indexOf = (name: string) =>
      MODEL_ORDER.indexOf(name as (typeof MODEL_ORDER)[number]);

    for (const [model, deps] of FK_DEPENDENCIES) {
      for (const dep of deps) {
        expect(indexOf(model)).toBeGreaterThan(indexOf(dep));
      }
    }
  });
});

describe('toClientProperty', () => {
  it('lowercases only the first character', () => {
    expect(toClientProperty('User')).toBe('user');
    expect(toClientProperty('TimeEntryTag')).toBe('timeEntryTag');
    expect(toClientProperty('OAuthAccount')).toBe('oAuthAccount');
  });
});
