import { Test, TestingModule } from '@nestjs/testing';
import { DbBackupService } from './db-backup.service';
import { PrismaService } from '../../prisma.service';
import { runExport } from '../../scripts/db-backup.core';

jest.mock('../../scripts/db-backup.core', () => ({
  runExport: jest.fn(),
}));

const runExportMock = runExport as jest.Mock;

describe('DbBackupService', () => {
  let service: DbBackupService;

  beforeEach(async () => {
    runExportMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DbBackupService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<DbBackupService>(DbBackupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs the written file and total row count on success', async () => {
    runExportMock.mockResolvedValue({
      file: '/app/db_dump/db-backup-2026-07-09T02-00-00-000Z.json',
      counts: { User: 3, Client: 2 },
    });
    const logSpy = jest
      .spyOn(service['logger'], 'log')
      .mockImplementation(() => {});

    await service.runDailyBackup();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('db-backup-2026-07-09T02-00-00-000Z.json'),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('5'));
    logSpy.mockRestore();
  });

  it('swallows export errors silently', async () => {
    runExportMock.mockRejectedValue(new Error('disk full'));

    await expect(service.runDailyBackup()).resolves.toBeUndefined();
  });

  it('logs error on failure', async () => {
    runExportMock.mockRejectedValue(new Error('disk full'));
    const errorSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => {});

    await service.runDailyBackup();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('backup'),
      expect.stringContaining('disk full'),
    );
    errorSpy.mockRestore();
  });
});
