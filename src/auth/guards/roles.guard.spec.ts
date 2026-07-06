import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

const makeContext = (user: { role?: string; adminPermissions?: string[] }) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    getType: () => 'graphql',
    getArgs: () => [{}, {}, { req: { user } }, {}],
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows when no @Roles() metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('denies when role does not match @Roles()', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === 'roles' ? ['ADMIN'] : undefined,
    );
    expect(guard.canActivate(makeContext({ role: 'USER' }))).toBe(false);
  });

  describe('permission check (adminPermissions)', () => {
    const setup = (
      roles: string[] | undefined,
      permission: string | undefined,
    ) => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
        if (key === 'roles') return roles;
        if (key === 'permission') return permission;
        return undefined;
      });
    };

    it('allows when role matches and no @RequirePermission() is set', () => {
      setup(['ADMIN'], undefined);
      expect(
        guard.canActivate(makeContext({ role: 'ADMIN', adminPermissions: [] })),
      ).toBe(true);
    });

    it('allows when adminPermissions is empty (superadmin — sees everything)', () => {
      setup(['ADMIN'], 'MANAGE_INVOICES');
      expect(
        guard.canActivate(makeContext({ role: 'ADMIN', adminPermissions: [] })),
      ).toBe(true);
    });

    it('allows when adminPermissions includes the required permission', () => {
      setup(['ADMIN'], 'MANAGE_INVOICES');
      expect(
        guard.canActivate(
          makeContext({
            role: 'ADMIN',
            adminPermissions: ['MANAGE_INVOICES', 'MANAGE_CLIENTS'],
          }),
        ),
      ).toBe(true);
    });

    it('throws ForbiddenException when adminPermissions does not include the required permission', () => {
      setup(['ADMIN'], 'MANAGE_INVOICES');
      expect(() =>
        guard.canActivate(
          makeContext({ role: 'ADMIN', adminPermissions: ['MANAGE_CLIENTS'] }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('allows when adminPermissions is undefined (stale pre-fix JWT during rollout — treated as superadmin, self-heals on next token refresh)', () => {
      setup(['ADMIN'], 'MANAGE_INVOICES');
      expect(guard.canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
    });
  });
});
