import { Injectable } from '@nestjs/common';
import {
  InvoiceRepository,
  InvoiceConnectionModel,
} from './repositories/invoice.repository';
import { AuditService } from '../audit/audit.service';
import { ClientsService } from '../clients/clients.service';
import { UsersService } from '../users/users.service';
import { InvoiceModel, InvoiceItemModel } from './types/invoice.type';
import {
  CreateInvoiceInput,
  AddInvoiceItemInput,
  UpdateInvoiceItemInput,
} from './dto/create-invoice.input';
import { UpdateInvoiceInput } from './dto/update-invoice.input';
import { GenerateInvoiceInput } from './dto/generate-invoice.input';
import type { ClientModel } from '../clients/types/client.type';
import { isAllowedLogoUrl } from '../common/logo-url.util';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly repo: InvoiceRepository,
    private readonly audit: AuditService,
    private readonly clientsService: ClientsService,
    private readonly usersService: UsersService,
  ) {}

  findAll(
    userId: number,
    status?: string,
    pagination?: { limit?: number; cursor?: number },
    clientId?: number,
    search?: string,
  ): Promise<InvoiceConnectionModel> {
    return this.repo.findAll(userId, status, pagination, clientId, search);
  }

  findOne(id: number, userId: number): Promise<InvoiceModel> {
    return this.repo.findById(id, userId);
  }

  async create(
    userId: number,
    input: CreateInvoiceInput,
  ): Promise<InvoiceModel> {
    const number = await this.repo.nextNumber(userId);
    const invoice = await this.repo.create(userId, number, input);
    this.audit.log(userId, 'INVOICE_CREATE', 'invoice', {
      invoiceId: invoice.id,
      number: invoice.number,
    });
    return invoice;
  }

  async generate(
    userId: number,
    input: GenerateInvoiceInput,
  ): Promise<InvoiceModel> {
    const number = await this.repo.nextNumber(userId);
    const invoice = await this.repo.generate(userId, number, input);
    this.audit.log(userId, 'INVOICE_CREATE', 'invoice', {
      invoiceId: invoice.id,
      number: invoice.number,
    });
    return invoice;
  }

  async update(
    id: number,
    userId: number,
    input: UpdateInvoiceInput,
  ): Promise<InvoiceModel> {
    let previousStatus: string | undefined;
    if (input.status !== undefined) {
      const current = await this.repo.findById(id, userId);
      previousStatus = current.status;
    }
    const invoice = await this.repo.update(id, userId, input);
    if (input.status !== undefined) {
      this.audit.log(userId, 'INVOICE_STATUS_CHANGE', 'invoice', {
        invoiceId: invoice.id,
        number: invoice.number,
        from: previousStatus,
        to: invoice.status,
      });
    }
    return invoice;
  }

  async delete(id: number, userId: number): Promise<boolean> {
    const invoice = await this.repo.findById(id, userId);
    await this.repo.delete(id, userId);
    this.audit.log(userId, 'INVOICE_DELETE', 'invoice', {
      invoiceId: id,
      number: invoice.number,
    });
    return true;
  }

  addItem(input: AddInvoiceItemInput): Promise<InvoiceItemModel> {
    return this.repo.addItem(input);
  }

  updateItem(
    id: number,
    data: UpdateInvoiceItemInput,
  ): Promise<InvoiceItemModel> {
    return this.repo.updateItem(id, data);
  }

  removeItem(id: number): Promise<boolean> {
    return this.repo.removeItem(id);
  }

  async generatePdf(id: number, userId: number): Promise<Uint8Array> {
    const invoice = await this.repo.findById(id, userId);

    let client: ClientModel | null = null;
    if (invoice.clientId !== null) {
      try {
        client = await this.clientsService.findOne(invoice.clientId, userId);
      } catch {
        /* client deleted or inaccessible — render PDF without address block */
      }
    }

    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const accent = rgb(0.2, 0.2, 0.6);
    const muted = rgb(0.5, 0.5, 0.5);
    const light = rgb(0.8, 0.8, 0.8);

    let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
    try {
      const user = await this.usersService.findOne(userId);
      if (user.logoUrl && isAllowedLogoUrl(user.logoUrl)) {
        const res = await fetch(user.logoUrl, {
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.body) throw new Error('Logo response has no body');
        const ct = res.headers.get('content-type') ?? '';
        let byteCount = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
          byteCount += chunk.length;
          if (byteCount > 2_097_152) throw new Error('Logo response too large');
          chunks.push(Buffer.from(chunk));
        }
        const bytes = new Uint8Array(Buffer.concat(chunks));
        if (ct.includes('image/png')) {
          logoImage = await doc.embedPng(bytes);
        } else if (ct.includes('image/jpeg')) {
          logoImage = await doc.embedJpg(bytes);
        }
      }
    } catch {
      /* logo fetch failure never aborts PDF generation */
    }

    const pages: ReturnType<typeof doc.addPage>[] = [];
    const firstPage = doc.addPage([595, 842]);
    pages.push(firstPage);
    let currentPage = firstPage;

    const { height } = firstPage.getSize();
    let leftY = height - 60;
    let rightY = height - 60;

    if (logoImage) {
      const MAX_W = 110;
      const MAX_H = 50;
      const scale = Math.min(
        MAX_W / logoImage.width,
        MAX_H / logoImage.height,
        1,
      );
      const w = logoImage.width * scale;
      const h = logoImage.height * scale;
      firstPage.drawImage(logoImage, {
        x: 545 - w,
        y: height - 30 - h,
        width: w,
        height: h,
      });
    }

    firstPage.drawText('INVOICE', {
      x: 50,
      y: leftY,
      size: 22,
      font: bold,
      color: accent,
    });
    leftY -= 30;
    firstPage.drawText(`Number: ${invoice.number}`, {
      x: 50,
      y: leftY,
      size: 11,
      font,
    });
    leftY -= 18;
    firstPage.drawText(`Status: ${invoice.status}`, {
      x: 50,
      y: leftY,
      size: 11,
      font,
    });
    leftY -= 18;
    if (invoice.issuedAt) {
      firstPage.drawText(
        `Issued: ${invoice.issuedAt.toISOString().slice(0, 10)}`,
        { x: 50, y: leftY, size: 11, font },
      );
      leftY -= 18;
    }
    if (invoice.dueDate) {
      firstPage.drawText(`Due: ${invoice.dueDate.toISOString().slice(0, 10)}`, {
        x: 50,
        y: leftY,
        size: 11,
        font,
      });
      leftY -= 18;
    }

    if (client) {
      firstPage.drawText('Bill To:', {
        x: 330,
        y: rightY,
        size: 9,
        font: bold,
        color: muted,
      });
      rightY -= 16;
      firstPage.drawText(client.name.slice(0, 38), {
        x: 330,
        y: rightY,
        size: 11,
        font: bold,
      });
      rightY -= 16;
      if (client.company) {
        firstPage.drawText(client.company.slice(0, 38), {
          x: 330,
          y: rightY,
          size: 10,
          font,
        });
        rightY -= 14;
      }
      if (client.address) {
        for (const line of client.address.split('\n').slice(0, 3)) {
          const trimmed = line.trim();
          if (trimmed) {
            firstPage.drawText(trimmed.slice(0, 38), {
              x: 330,
              y: rightY,
              size: 10,
              font,
            });
            rightY -= 14;
          }
        }
      }
      if (client.email) {
        firstPage.drawText(client.email.slice(0, 38), {
          x: 330,
          y: rightY,
          size: 10,
          font,
        });
        rightY -= 14;
      }
      if (client.phone) {
        firstPage.drawText(client.phone.slice(0, 38), {
          x: 330,
          y: rightY,
          size: 10,
          font,
        });
        rightY -= 14;
      }
    }

    let y = Math.min(leftY, rightY) - 10;
    firstPage.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: light,
    });
    y -= 20;

    const drawColumnHeaders = (
      p: ReturnType<typeof doc.addPage>,
      yPos: number,
    ) => {
      p.drawText('Description', { x: 50, y: yPos, size: 10, font: bold });
      p.drawText('Qty', { x: 320, y: yPos, size: 10, font: bold });
      p.drawText('Unit Price', { x: 380, y: yPos, size: 10, font: bold });
      p.drawText('Total', { x: 480, y: yPos, size: 10, font: bold });
    };
    drawColumnHeaders(firstPage, y);
    y -= 16;

    let subtotal = 0;
    for (const item of invoice.items ?? []) {
      if (y < 100) {
        currentPage = doc.addPage([595, 842]);
        pages.push(currentPage);
        y = height - 60;
        drawColumnHeaders(currentPage, y);
        y -= 16;
      }
      currentPage.drawText(item.description.slice(0, 50), {
        x: 50,
        y,
        size: 10,
        font,
      });
      currentPage.drawText(item.quantity.toFixed(2), {
        x: 320,
        y,
        size: 10,
        font,
      });
      currentPage.drawText(item.unitPrice.toFixed(2), {
        x: 380,
        y,
        size: 10,
        font,
      });
      currentPage.drawText(item.total.toFixed(2), {
        x: 480,
        y,
        size: 10,
        font,
      });
      subtotal += item.total;
      y -= 16;
    }

    if (y < 80) {
      currentPage = doc.addPage([595, 842]);
      pages.push(currentPage);
      y = height - 60;
    }

    y -= 10;
    currentPage.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: light,
    });
    y -= 20;
    currentPage.drawText(
      `Total (${invoice.currency}): ${subtotal.toFixed(2)}`,
      { x: 380, y, size: 12, font: bold },
    );

    if (invoice.notes) {
      y -= 30;
      currentPage.drawText('Notes:', { x: 50, y, size: 10, font: bold });
      y -= 14;
      for (const line of invoice.notes.split('\n').slice(0, 5)) {
        const trimmed = line.trim();
        if (trimmed && y > 50) {
          currentPage.drawText(trimmed.slice(0, 80), {
            x: 50,
            y,
            size: 10,
            font,
            color: muted,
          });
          y -= 14;
        }
      }
    }

    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      pages[i].drawText(`Page ${i + 1} of ${totalPages}`, {
        x: 50,
        y: 25,
        size: 8,
        font,
        color: muted,
      });
    }

    return doc.save();
  }
}
