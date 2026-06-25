import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma.service';

const makeEntry = (id: number) => ({
  id,
  userId: 1,
  action: 'TEST_ACTION',
  resource: 'test',
  payload: null,
  createdAt: new Date(),
  user: { email: 'user@example.com' },
});

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditLog: { create: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('creates audit log entry with userId, action, resource', async () => {
      service.log(1, 'INVOICE_CREATE', 'invoice');
      await new Promise((r) => process.nextTick(r));

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: { userId: 1, action: 'INVOICE_CREATE', resource: 'invoice' },
      });
    });

    it('includes payload when provided', async () => {
      service.log(2, 'PROJECT_DELETE', 'project', { projectId: 5 });
      await new Promise((r) => process.nextTick(r));

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 2,
          action: 'PROJECT_DELETE',
          resource: 'project',
          payload: { projectId: 5 },
        },
      });
    });

    it('is fire-and-forget — returns void synchronously', () => {
      const result = service.log(1, 'ACTION', 'res');
      expect(result).toBeUndefined();
    });

    it('swallows prisma errors silently', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('DB down'));

      service.log(1, 'ACTION', 'res');
      // Should not throw — catch() swallows the error
      await new Promise((r) => process.nextTick(r));
    });
  });

  describe('findAll', () => {
    it('returns items and null nextCursor when no overflow', async () => {
      const rows = [makeEntry(5), makeEntry(3)];
      prisma.auditLog.findMany.mockResolvedValue(rows);

      const result = await service.findAll({ limit: 50 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it('paginates — sets nextCursor when more rows than limit', async () => {
      // limit=2, return 3 rows → hasMore=true
      const rows = [makeEntry(10), makeEntry(8), makeEntry(6)];
      prisma.auditLog.findMany.mockResolvedValue(rows);

      const result = await service.findAll({ limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe(8); // last item id
    });

    it('filters by userId when provided', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.findAll({ userId: 7 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 7 },
        }),
      );
    });

    it('filters by cursor (id < cursor) when provided', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.findAll({ cursor: 50 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { lt: 50 } },
        }),
      );
    });

    it('uses default limit of 50 when not specified', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.findAll({});

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }),
      );
    });

    it('orders by id desc', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.findAll({});

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { id: 'desc' } }),
      );
    });
  });
});
