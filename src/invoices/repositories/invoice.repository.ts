import {
  CreateInvoiceInput,
  AddInvoiceItemInput,
  UpdateInvoiceItemInput,
} from '../dto/create-invoice.input';
import { UpdateInvoiceInput } from '../dto/update-invoice.input';
import { GenerateInvoiceInput } from '../dto/generate-invoice.input';
import { InvoiceModel, InvoiceItemModel } from '../types/invoice.type';

export interface InvoiceConnectionModel {
  items: InvoiceModel[];
  nextCursor: number | null;
  total: number;
}

type PaginationArgs = { limit?: number; cursor?: number };

export abstract class InvoiceRepository {
  abstract findById(id: number, userId: number): Promise<InvoiceModel>;
  abstract findAll(
    userId: number,
    status?: string,
    pagination?: PaginationArgs,
    clientId?: number,
    search?: string,
  ): Promise<InvoiceConnectionModel>;
  abstract create(
    userId: number,
    number: string,
    data: CreateInvoiceInput,
  ): Promise<InvoiceModel>;
  abstract generate(
    userId: number,
    number: string,
    data: GenerateInvoiceInput,
  ): Promise<InvoiceModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateInvoiceInput,
  ): Promise<InvoiceModel>;
  abstract delete(id: number, userId: number): Promise<InvoiceModel>;
  abstract addItem(data: AddInvoiceItemInput): Promise<InvoiceItemModel>;
  abstract updateItem(
    id: number,
    data: UpdateInvoiceItemInput,
  ): Promise<InvoiceItemModel>;
  abstract removeItem(id: number): Promise<boolean>;
  abstract nextNumber(userId: number): Promise<string>;
}
