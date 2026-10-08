import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { seedUser } from '../../prisma8/testing/seed';
import { useTestDb } from '../../prisma8/testing/test-db';
import { AdminPermission, Role } from '../entities/user.entity';
import { Prisma8UserRepository } from './prisma8-user.repository';
import { UserRepository } from './users.repository';

const db = useTestDb();
const config = {
  getOrThrow: (key: string) => {
    if (key !== 'APP_ENCRYPTION_KEY')
      throw new Error(`unexpected config ${key}`);
    return process.env.APP_ENCRYPTION_KEY;
  },
} as unknown as ConfigService;

const MISSING = 999999;

describe.each([
  [
    'prisma8',
    (): UserRepository => new Prisma8UserRepository(db.prisma8, config),
  ],
])('UserRepository (%s)', (_impl, make) => {
  let repo: UserRepository;

  const stored = async (id: number) =>
    (await db.prisma8.orm.public.User.first({ id }))!;

  // Another user, created first: a write that loses its filter lands here.
  let decoy: Awaited<ReturnType<typeof seedUser>>;

  beforeEach(async () => {
    repo = make();
    decoy = await seedUser(db.prisma8);
  });

  afterEach(async () => {
    await expect(stored(decoy.id)).resolves.toEqual(decoy);
  });

  describe('create / findById / findAll', () => {
    it('creates a user with defaults and reads it back', async () => {
      const user = await repo.create({ email: 'new@test.io', name: 'New' });
      expect(user).toMatchObject({
        email: 'new@test.io',
        name: 'New',
        role: 'USER',
        twoFactorEnabled: false,
        defaultCurrency: 'EUR',
        adminPermissions: [],
        clockifyApiKey: null,
      });
      await expect(repo.findById(user.id)).resolves.toMatchObject({
        id: user.id,
        email: 'new@test.io',
      });
      await expect(
        repo.findAll().then((all) => all.map((u) => u.id)),
      ).resolves.toEqual([decoy.id, user.id]);
    });

    it('reads a null admin permission list as empty', async () => {
      const { id } = await seedUser(db.prisma8, { adminPermissions: null });
      await expect(repo.findById(id)).resolves.toMatchObject({
        adminPermissions: [],
      });
    });

    it('throws NotFound for an unknown id', async () => {
      await expect(repo.findById(MISSING)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('changes role and admin permissions', async () => {
      const { id } = await seedUser(db.prisma8);
      await expect(
        repo.update(id, {
          id,
          role: Role.ADMIN,
          adminPermissions: [AdminPermission.MANAGE_USERS],
        }),
      ).resolves.toMatchObject({
        id,
        role: 'ADMIN',
        adminPermissions: ['MANAGE_USERS'],
      });
    });

    it('returns stored credentials decrypted', async () => {
      const { id } = await seedUser(db.prisma8);
      await repo.updateClockify(id, { clockifyApiKey: 'k' });
      await expect(
        repo.update(id, { id, role: Role.MANAGER }),
      ).resolves.toMatchObject({ role: 'MANAGER', clockifyApiKey: 'k' });
    });

    it('throws NotFound for an unknown id', async () => {
      await expect(
        repo.update(MISSING, { id: MISSING, role: Role.USER }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('third-party credentials', () => {
    it('encrypts the Clockify key at rest and decrypts it on read', async () => {
      const { id } = await seedUser(db.prisma8);
      const returned = await repo.updateClockify(id, {
        clockifyApiKey: 'secret-key',
        clockifyWorkspaceId: 'ws1',
      });

      const row = await stored(id);
      expect(row.clockifyApiKey).not.toBe('secret-key');
      expect(row.clockifyWorkspaceId).toBe('ws1');
      expect(returned).toMatchObject({
        clockifyApiKey: 'secret-key',
        clockifyWorkspaceId: 'ws1',
      });
      await expect(repo.findById(id)).resolves.toMatchObject({
        clockifyApiKey: 'secret-key',
        clockifyWorkspaceId: 'ws1',
      });
    });

    it('encrypts both HubSpot tokens and keeps the other fields as given', async () => {
      const { id } = await seedUser(db.prisma8);
      const expiresAt = new Date('2026-12-01T10:00:00.000Z');
      const returned = await repo.updateHubspot(id, {
        hubspotAccessToken: 'access',
        hubspotRefreshToken: 'refresh',
        hubspotTokenExpiresAt: expiresAt,
        hubspotPortalId: 'p1',
      });

      const row = await stored(id);
      expect([row.hubspotAccessToken, row.hubspotRefreshToken]).not.toContain(
        'access',
      );
      expect(row.hubspotRefreshToken).not.toBe('refresh');
      expect(returned).toMatchObject({
        hubspotAccessToken: 'access',
        hubspotRefreshToken: 'refresh',
      });
      await expect(repo.findById(id)).resolves.toMatchObject({
        hubspotAccessToken: 'access',
        hubspotRefreshToken: 'refresh',
        hubspotTokenExpiresAt: expiresAt,
        hubspotPortalId: 'p1',
      });
    });

    it('encrypts both Google Calendar tokens', async () => {
      const { id } = await seedUser(db.prisma8);
      const returned = await repo.updateGoogleCalendar(id, {
        googleCalendarAccessToken: 'g-access',
        googleCalendarRefreshToken: 'g-refresh',
        googleCalendarEmail: 'me@gmail.com',
        googleCalendarTokenExpiresAt: new Date('2026-12-01T10:00:00.000Z'),
      });

      const row = await stored(id);
      expect(row.googleCalendarAccessToken).not.toBe('g-access');
      expect(returned).toMatchObject({
        googleCalendarAccessToken: 'g-access',
        googleCalendarRefreshToken: 'g-refresh',
      });
      await expect(repo.findById(id)).resolves.toMatchObject({
        googleCalendarAccessToken: 'g-access',
        googleCalendarRefreshToken: 'g-refresh',
        googleCalendarEmail: 'me@gmail.com',
        googleCalendarTokenExpiresAt: new Date('2026-12-01T10:00:00.000Z'),
      });
    });

    it('clears credentials with null', async () => {
      const { id } = await seedUser(db.prisma8);
      await repo.updateClockify(id, { clockifyApiKey: 'k' });
      await repo.updateClockify(id, {
        clockifyApiKey: null,
        clockifyWorkspaceId: null,
      });
      await expect(repo.findById(id)).resolves.toMatchObject({
        clockifyApiKey: null,
        clockifyWorkspaceId: null,
      });
    });

    it('returns a value stored unencrypted as-is', async () => {
      const { id } = await seedUser(db.prisma8, {
        clockifyApiKey: 'legacy-plain',
      });
      await expect(repo.findById(id)).resolves.toMatchObject({
        clockifyApiKey: 'legacy-plain',
      });
    });

    it.each([
      [
        'updateClockify',
        (r: UserRepository) =>
          r.updateClockify(MISSING, { clockifyApiKey: 'k' }),
      ],
      [
        'updateHubspot',
        (r: UserRepository) =>
          r.updateHubspot(MISSING, { hubspotPortalId: 'p' }),
      ],
      [
        'updateGoogleCalendar',
        (r: UserRepository) =>
          r.updateGoogleCalendar(MISSING, { googleCalendarEmail: 'e' }),
      ],
    ])('%s throws NotFound for an unknown id', async (_name, call) => {
      await expect(call(repo)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes and returns the user, NotFound for an unknown id', async () => {
      const { id } = await seedUser(db.prisma8);
      await expect(repo.delete(id)).resolves.toMatchObject({ id });
      await expect(repo.findById(id)).rejects.toBeInstanceOf(NotFoundException);
      await expect(repo.delete(MISSING)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
