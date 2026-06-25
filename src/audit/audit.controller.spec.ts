import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;
  let service: { findAll: jest.Mock };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: service }],
    }).compile();

    controller = module.get(AuditController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll — delegates with no filters', async () => {
    await controller.findAll();
    expect(service.findAll).toHaveBeenCalledWith({
      userId: undefined,
      limit: undefined,
      cursor: undefined,
    });
  });

  it('findAll — passes userId, limit, cursor', async () => {
    await controller.findAll(7, 25, 100);
    expect(service.findAll).toHaveBeenCalledWith({
      userId: 7,
      limit: 25,
      cursor: 100,
    });
  });

  it('findAll — returns service result', async () => {
    const data = { items: [{ id: 1 }], nextCursor: 1 };
    service.findAll.mockResolvedValue(data);

    const result = await controller.findAll(1);
    expect(result).toEqual(data);
  });
});
