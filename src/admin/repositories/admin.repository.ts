import {
  AdminStatsModel,
  AdminClientModel,
  AdminProjectModel,
  AdminInvoiceModel,
  AdminTimeEntryModel,
  AdminRateModel,
  AdminConnectionModel,
  AdminDeleteResultModel,
} from '../types/admin.type';
import {
  AdminCreateClientInput,
  AdminUpdateClientInput,
  AdminCreateProjectInput,
  AdminUpdateProjectInput,
  AdminUpdateInvoiceInput,
  AdminCreateRateInput,
  AdminUpdateRateInput,
} from '../dto/admin.input';
import { ProjectStatus } from '../../projects/entities/project.entity';
import { InvoiceStatus } from '../../invoices/entities/invoice.entity';
import { RateType } from '../../generated/prisma/client';

export abstract class AdminRepository {
  abstract getStats(): Promise<AdminStatsModel>;

  abstract findClients(
    pagination?: { limit?: number; cursor?: number },
    search?: string,
  ): Promise<AdminConnectionModel<AdminClientModel>>;

  abstract findProjects(
    pagination?: { limit?: number; cursor?: number },
    search?: string,
    status?: ProjectStatus,
  ): Promise<AdminConnectionModel<AdminProjectModel>>;

  abstract findInvoices(
    pagination?: { limit?: number; cursor?: number },
    search?: string,
    status?: InvoiceStatus,
  ): Promise<AdminConnectionModel<AdminInvoiceModel>>;

  abstract findTimeEntries(
    pagination?: { limit?: number; cursor?: number },
    userId?: number,
  ): Promise<AdminConnectionModel<AdminTimeEntryModel>>;

  abstract findRates(
    type?: RateType,
  ): Promise<AdminConnectionModel<AdminRateModel>>;

  abstract createClient(
    input: AdminCreateClientInput,
  ): Promise<AdminClientModel>;

  abstract updateClient(
    id: number,
    input: AdminUpdateClientInput,
  ): Promise<AdminClientModel>;

  abstract deleteClient(id: number): Promise<AdminDeleteResultModel>;

  abstract createProject(
    input: AdminCreateProjectInput,
  ): Promise<AdminProjectModel>;

  abstract updateProject(
    id: number,
    input: AdminUpdateProjectInput,
  ): Promise<AdminProjectModel>;

  abstract deleteProject(id: number): Promise<AdminDeleteResultModel>;

  abstract updateInvoice(
    id: number,
    input: AdminUpdateInvoiceInput,
  ): Promise<AdminInvoiceModel>;

  abstract deleteInvoice(id: number): Promise<AdminDeleteResultModel>;

  abstract deleteTimeEntry(id: number): Promise<AdminDeleteResultModel>;

  abstract createRate(input: AdminCreateRateInput): Promise<AdminRateModel>;

  abstract updateRate(
    id: number,
    input: AdminUpdateRateInput,
  ): Promise<AdminRateModel>;

  abstract deleteRate(id: number): Promise<AdminDeleteResultModel>;
}
