import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

type AuthRequest = Parameters<AttachmentsController['uploadFile']>[0];

const makeReq = (userId = 7, fileData?: { filename: string; buffer: Buffer }) =>
  ({
    user: { id: userId, email: 'u@e.com', role: 'USER' },
    file: fileData
      ? jest.fn().mockResolvedValue({
          filename: fileData.filename,
          toBuffer: jest.fn().mockResolvedValue(fileData.buffer),
        })
      : jest.fn().mockResolvedValue(null),
  }) as unknown as AuthRequest;

const makeAttachment = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  taskId: 10,
  type: 'URL',
  url: 'https://example.com',
  displayText: null,
  ...overrides,
});

describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let service: {
    createFileAttachment: jest.Mock;
    createUrlAttachment: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      createFileAttachment: jest.fn(),
      createUrlAttachment: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [{ provide: AttachmentsService, useValue: service }],
    }).compile();

    controller = module.get(AttachmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadFile', () => {
    it('uploads file and delegates to service', async () => {
      const buffer = Buffer.from('file-content');
      const req = makeReq(7, { filename: 'doc.pdf', buffer });
      const attachment = makeAttachment({ type: 'FILE', fileName: 'doc.pdf' });
      service.createFileAttachment.mockResolvedValue(attachment);

      const result = await controller.uploadFile(req, 10, 'local');

      expect(service.createFileAttachment).toHaveBeenCalledWith(
        10,
        'doc.pdf',
        buffer,
        7,
        'local',
      );
      expect(result).toEqual(attachment);
    });

    it('throws BadRequestException when no file in request', async () => {
      const req = makeReq(7); // file() resolves to null

      await expect(controller.uploadFile(req, 10)).rejects.toThrow(
        BadRequestException,
      );
      expect(service.createFileAttachment).not.toHaveBeenCalled();
    });

    it('passes undefined driver when not provided', async () => {
      const buffer = Buffer.from('data');
      const req = makeReq(7, { filename: 'img.png', buffer });
      service.createFileAttachment.mockResolvedValue(makeAttachment());

      await controller.uploadFile(req, 10);

      expect(service.createFileAttachment).toHaveBeenCalledWith(
        10,
        'img.png',
        buffer,
        7,
        undefined,
      );
    });
  });

  describe('createUrl', () => {
    it('creates URL attachment', async () => {
      const req = makeReq();
      const attachment = makeAttachment({
        url: 'https://docs.example.com',
        displayText: 'Docs',
      });
      service.createUrlAttachment.mockResolvedValue(attachment);

      const result = await controller.createUrl(req, 10, {
        url: 'https://docs.example.com',
        displayText: 'Docs',
      });

      expect(service.createUrlAttachment).toHaveBeenCalledWith(
        10,
        'https://docs.example.com',
        'Docs',
        7,
      );
      expect(result).toEqual(attachment);
    });

    it('trims whitespace from url and displayText', async () => {
      const req = makeReq();
      service.createUrlAttachment.mockResolvedValue(makeAttachment());

      await controller.createUrl(req, 10, {
        url: '  https://example.com  ',
        displayText: '  My Link  ',
      });

      expect(service.createUrlAttachment).toHaveBeenCalledWith(
        10,
        'https://example.com',
        'My Link',
        7,
      );
    });

    it('converts empty displayText to undefined', async () => {
      const req = makeReq();
      service.createUrlAttachment.mockResolvedValue(makeAttachment());

      await controller.createUrl(req, 10, {
        url: 'https://example.com',
        displayText: '   ',
      });

      expect(service.createUrlAttachment).toHaveBeenCalledWith(
        10,
        'https://example.com',
        undefined,
        7,
      );
    });

    it('throws BadRequestException for empty url', () => {
      const req = makeReq();

      expect(() => controller.createUrl(req, 10, { url: '' })).toThrow(
        BadRequestException,
      );
      expect(() => controller.createUrl(req, 10, { url: '   ' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateAttachment', () => {
    it('updates attachment with trimmed values', async () => {
      const req = makeReq();
      const updated = makeAttachment({
        url: 'https://new.com',
        displayText: 'New',
      });
      service.update.mockResolvedValue(updated);

      const result = await controller.updateAttachment(req, 1, {
        url: ' https://new.com ',
        displayText: ' New ',
      });

      expect(service.update).toHaveBeenCalledWith(
        1,
        'https://new.com',
        'New',
        7,
      );
      expect(result).toEqual(updated);
    });

    it('converts empty displayText to undefined', async () => {
      const req = makeReq();
      service.update.mockResolvedValue(makeAttachment());

      await controller.updateAttachment(req, 1, {
        url: 'https://new.com',
        displayText: '',
      });

      expect(service.update).toHaveBeenCalledWith(
        1,
        'https://new.com',
        undefined,
        7,
      );
    });

    it('throws BadRequestException for empty url', async () => {
      const req = makeReq();

      await expect(
        controller.updateAttachment(req, 1, { url: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAttachment', () => {
    it('deletes attachment and returns ok', async () => {
      const req = makeReq();
      service.delete.mockResolvedValue(undefined);

      const result = await controller.deleteAttachment(req, 1);

      expect(service.delete).toHaveBeenCalledWith(1, 7);
      expect(result).toEqual({ ok: true });
    });
  });
});
