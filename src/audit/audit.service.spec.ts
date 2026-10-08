import { Test, TestingModule } from '@nestjs/testing';
import { Prisma8Service } from '../prisma8/prisma8.service';
import { AuditService } from './audit.service';

// Queries are covered against a real database in audit.service.int-spec.ts;
// this covers the fire-and-forget write and the paging arithmetic.

const row = (id: number) => ({
  id,
  userId: 1,
  action: 'TEST_ACTION',
  resource: 'test',
  payload: null,
  createdAt: '2026-10-08 10:00:00.000',
  user: { email: 'user@example.com' },
});

describe('AuditService', () => {
  let service: AuditService;
  let create: jest.Mock;
  let all: jest.Mock;

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue({ id: 1 });
    all = jest.fn().mockResolvedValue([]);
    const chain: Record<string, unknown> = { all };
    for (const step of ['where', 'include', 'orderBy', 'limit'])
      chain[step] = () => chain;
    const db = {
      orm: { public: { AuditLog: { create, where: () => chain } } },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: Prisma8Service, useValue: db }],
    }).compile();
    service = module.get(AuditService);
  });

  describe('log', () => {
    it('writes userId, action and resource', async () => {
      service.log(1, 'INVOICE_CREATE', 'invoice');
      await new Promise((r) => process.nextTick(r));
      expect(create).toHaveBeenCalledWith({
        userId: 1,
        action: 'INVOICE_CREATE',
        resource: 'invoice',
      });
    });

    it('includes the payload when given', async () => {
      service.log(2, 'PROJECT_DELETE', 'project', { projectId: 5 });
      await new Promise((r) => process.nextTick(r));
      expect(create).toHaveBeenCalledWith({
        userId: 2,
        action: 'PROJECT_DELETE',
        resource: 'project',
        payload: { projectId: 5 },
      });
    });

    it('returns synchronously and swallows a failed write', async () => {
      create.mockRejectedValue(new Error('DB down'));
      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});
      expect(service.log(1, 'ACTION', 'res')).toBeUndefined();
      await new Promise((r) => setImmediate(r));
      expect(errorSpy).toHaveBeenCalledWith(
        'Audit log write failed',
        expect.stringContaining('DB down'),
      );
    });
  });

  describe('findAll', () => {
    it('returns every row and no cursor when there is no overflow', async () => {
      all.mockResolvedValue([row(5), row(3)]);
      const result = await service.findAll({ limit: 50 });
      expect(result.items.map((i) => i.id)).toEqual([5, 3]);
      expect(result.items[0].createdAt).toEqual(
        new Date('2026-10-08T10:00:00.000Z'),
      );
      expect(result.nextCursor).toBeNull();
    });

    it('trims the extra row and points the cursor at the last item', async () => {
      all.mockResolvedValue([row(10), row(8), row(6)]);
      const result = await service.findAll({ limit: 2 });
      expect(result.items.map((i) => i.id)).toEqual([10, 8]);
      expect(result.nextCursor).toBe(8);
    });
  });
});
