import { Test, TestingModule } from '@nestjs/testing';
import type { FastifyReply } from 'fastify';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: { generatePdf: jest.Mock };

  beforeEach(async () => {
    service = { generatePdf: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [{ provide: InvoicesService, useValue: service }],
    }).compile();

    controller = module.get(InvoicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('downloadPdf', () => {
    it('calls generatePdf and sends pdf response', async () => {
      const pdfBytes = new Uint8Array([37, 80, 68, 70]); // %PDF
      service.generatePdf.mockResolvedValue(pdfBytes);

      const mockRes = {
        header: jest.fn().mockReturnThis(),
        send: jest.fn().mockResolvedValue(undefined),
      };
      const mockReq = { user: { id: 7 } };

      await controller.downloadPdf(
        42,
        mockReq,
        mockRes as unknown as FastifyReply,
      );

      expect(service.generatePdf).toHaveBeenCalledWith(42, 7);
      expect(mockRes.header).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(mockRes.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="invoice-42.pdf"',
      );
      expect(mockRes.send).toHaveBeenCalledWith(Buffer.from(pdfBytes));
    });
  });
});
