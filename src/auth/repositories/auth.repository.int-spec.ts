import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { seedUser } from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { AuthRepository } from './auth.repository';
import { PrismaAuthRepository } from './prisma-auth.repository';
import { anyDate, anyNumber } from '../../prisma8/testing/matchers';

const db = useTestDb();
const config = {
  getOrThrow: () => process.env.APP_ENCRYPTION_KEY,
} as unknown as ConfigService;

describe.each([
  [
    'prisma7',
    (): AuthRepository => new PrismaAuthRepository(db.prisma7, config),
  ],
])('AuthRepository (%s)', (_impl, make) => {
  let repo: AuthRepository;
  let user: number;
  let other: number;

  const stored = async (id: number) =>
    (await db.prisma8.orm.public.User.first({ id }))!;

  beforeEach(async () => {
    repo = make();
    user = (await seedUser(db.prisma8, { email: 'me@test.io' })).id;
    other = (await seedUser(db.prisma8)).id;
  });

  describe('users', () => {
    it('creates a user and finds it by email or id, null when unknown', async () => {
      const created = await repo.createUser({
        email: 'new@test.io',
        password: 'hash',
        name: 'New',
      });
      expect(created).toMatchObject({
        email: 'new@test.io',
        password: 'hash',
        name: 'New',
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });
      await expect(repo.findUserByEmail('new@test.io')).resolves.toMatchObject({
        id: created.id,
      });
      await expect(repo.findUserById(created.id)).resolves.toMatchObject({
        email: 'new@test.io',
      });
      await expect(repo.findUserByEmail('nobody@test.io')).resolves.toBeNull();
      await expect(repo.findUserById(999999)).resolves.toBeNull();
    });

    it('updates profile fields and the password', async () => {
      await expect(
        repo.updateUser(user, {
          name: 'Me',
          jobTitle: 'Translator',
          defaultCurrency: 'USD',
          mobilePhone: null,
        }),
      ).resolves.toMatchObject({
        name: 'Me',
        jobTitle: 'Translator',
        defaultCurrency: 'USD',
        mobilePhone: null,
        email: 'me@test.io',
      });
      await repo.updatePassword(user, 'new-hash');
      await expect(stored(user)).resolves.toMatchObject({
        password: 'new-hash',
      });
    });

    it('deletes a user', async () => {
      await repo.deleteUser(other);
      await expect(repo.findUserById(other)).resolves.toBeNull();
      await expect(repo.findUserById(user)).resolves.not.toBeNull();
    });
  });

  describe('two-factor secret', () => {
    it('is encrypted at rest and decrypted on read', async () => {
      await repo.setTwoFactorSecret(user, 'JBSWY3DPEHPK3PXP');
      expect((await stored(user)).twoFactorSecret).not.toBe('JBSWY3DPEHPK3PXP');
      await expect(repo.findUserById(user)).resolves.toMatchObject({
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      });
      await expect(repo.findUserByEmail('me@test.io')).resolves.toMatchObject({
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      });
      await expect(repo.isTwoFactorSecretEncrypted(user)).resolves.toBe(true);
    });

    it('reads a legacy plain secret as-is and reports it unencrypted', async () => {
      await db.prisma8.orm.public.User.where({ id: user }).update({
        twoFactorSecret: 'PLAINSECRET',
      });
      await expect(repo.findUserById(user)).resolves.toMatchObject({
        twoFactorSecret: 'PLAINSECRET',
      });
      await expect(repo.isTwoFactorSecretEncrypted(user)).resolves.toBe(false);
    });

    it('reports no secret as unencrypted', async () => {
      await expect(repo.isTwoFactorSecretEncrypted(user)).resolves.toBe(false);
      await expect(repo.isTwoFactorSecretEncrypted(999999)).resolves.toBe(
        false,
      );
    });

    it('enables, then disables clearing the secret', async () => {
      await repo.setTwoFactorSecret(user, 'S');
      await repo.enableTwoFactor(user);
      await expect(repo.findUserById(user)).resolves.toMatchObject({
        twoFactorEnabled: true,
        twoFactorSecret: 'S',
      });
      await repo.disableTwoFactor(user);
      await expect(repo.findUserById(user)).resolves.toMatchObject({
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });
    });
  });

  describe('refresh tokens', () => {
    it('stores, finds and deletes one token, or all of a user', async () => {
      const expiresAt = new Date('2026-12-01T00:00:00.000Z');
      await repo.storeRefreshToken(user, 'h1', expiresAt);
      await repo.storeRefreshToken(user, 'h2', expiresAt);
      await repo.storeRefreshToken(other, 'h3', expiresAt);

      await expect(repo.findRefreshTokenByHash('h1')).resolves.toEqual({
        id: anyNumber,
        tokenHash: 'h1',
        userId: user,
        expiresAt,
        createdAt: anyDate,
      });
      await repo.deleteRefreshToken('h1');
      await expect(repo.findRefreshTokenByHash('h1')).resolves.toBeNull();
      await expect(repo.deleteRefreshToken('unknown')).resolves.toBeUndefined();

      await repo.deleteUserRefreshTokens(user);
      await expect(repo.findRefreshTokenByHash('h2')).resolves.toBeNull();
      await expect(repo.findRefreshTokenByHash('h3')).resolves.toMatchObject({
        userId: other,
      });
    });
  });

  describe('OAuth', () => {
    it('creates a user and its account on first sign-in, then finds it', async () => {
      await expect(repo.findOAuthUser('google', 'g-1')).resolves.toBeNull();
      const created = await repo.upsertOAuthUser(
        'google',
        'g-1',
        'oauth@test.io',
        'OAuth',
      );
      expect(created).toMatchObject({
        email: 'oauth@test.io',
        name: 'OAuth',
        password: null,
      });
      await expect(repo.findOAuthUser('google', 'g-1')).resolves.toMatchObject({
        id: created.id,
      });
      await expect(
        repo.upsertOAuthUser('google', 'g-1', 'changed@test.io'),
      ).resolves.toMatchObject({ id: created.id, email: 'oauth@test.io' });
    });

    it('links to an existing user with the same email instead of duplicating it', async () => {
      const linked = await repo.upsertOAuthUser(
        'google',
        'g-2',
        'me@test.io',
        'Ignored',
      );
      expect(linked).toMatchObject({ id: user, email: 'me@test.io' });
      await expect(repo.findOAuthUser('google', 'g-2')).resolves.toMatchObject({
        id: user,
      });
      await expect(db.prisma8.orm.public.User.all()).resolves.toHaveLength(2);
    });
  });

  describe('password reset tokens', () => {
    it('creates, finds and deletes one token, or all of a user', async () => {
      const expiresAt = new Date('2026-10-08T00:00:00.000Z');
      await repo.createPasswordResetToken(user, 'r1', expiresAt);
      await repo.createPasswordResetToken(user, 'r2', expiresAt);
      await repo.createPasswordResetToken(other, 'r3', expiresAt);

      await expect(repo.findPasswordResetToken('r1')).resolves.toEqual({
        userId: user,
        expiresAt,
      });
      await repo.deletePasswordResetToken('r1');
      await expect(repo.findPasswordResetToken('r1')).resolves.toBeNull();

      await repo.deleteUserPasswordResetTokens(user);
      await expect(repo.findPasswordResetToken('r2')).resolves.toBeNull();
      await expect(repo.findPasswordResetToken('r3')).resolves.toEqual({
        userId: other,
        expiresAt,
      });
    });
  });

  describe('backup codes', () => {
    const hashes = (codes: string[]) =>
      Promise.all(codes.map((c) => bcrypt.hash(c, 4)));

    it('consumes a matching code once and counts what is left', async () => {
      await repo.createBackupCodes(
        user,
        await hashes(['aaaa-1111', 'bbbb-2222']),
      );
      await repo.createBackupCodes(other, await hashes(['cccc-3333']));
      await expect(repo.getBackupCodeCount(user)).resolves.toBe(2);

      const used = await repo.findMatchingBackupCode(user, 'bbbb-2222');
      expect(used).toEqual({ id: anyNumber });
      await expect(repo.getBackupCodeCount(user)).resolves.toBe(1);
      await expect(
        repo.findMatchingBackupCode(user, 'bbbb-2222'),
      ).resolves.toBeNull();
      await expect(
        repo.findMatchingBackupCode(user, 'wrong'),
      ).resolves.toBeNull();
      await expect(
        repo.findMatchingBackupCode(user, 'cccc-3333'),
      ).resolves.toBeNull();
      await expect(repo.getBackupCodeCount(other)).resolves.toBe(1);
    });

    it('deletes all codes of a user', async () => {
      await repo.createBackupCodes(user, await hashes(['aaaa-1111']));
      await repo.deleteBackupCodes(user);
      await expect(repo.getBackupCodeCount(user)).resolves.toBe(0);
    });
  });
});
