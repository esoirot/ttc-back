import { Injectable } from '@nestjs/common';
import { AdminRepository } from './repositories/admin.repository';
import { AuditService } from '../audit/audit.service';
import {
  AdminCreateClientInput,
  AdminUpdateClientInput,
  AdminCreateProjectInput,
  AdminUpdateProjectInput,
  AdminUpdateInvoiceInput,
  AdminCreateRateInput,
  AdminUpdateRateInput,
} from './dto/admin.input';
import { ProjectStatus } from '../projects/entities/project.entity';
import { InvoiceStatus } from '../invoices/entities/invoice.entity';
import { RateType } from '../rates/entities/rate.entity';

@Injectable()
export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly audit: AuditService,
  ) {}

  getStats() {
    return this.repo.getStats();
  }

  findClients(
    pagination?: { limit?: number; cursor?: number },
    search?: string,
  ) {
    return this.repo.findClients(pagination, search);
  }

  findProjects(
    pagination?: { limit?: number; cursor?: number },
    search?: string,
    status?: ProjectStatus,
  ) {
    return this.repo.findProjects(pagination, search, status);
  }

  findInvoices(
    pagination?: { limit?: number; cursor?: number },
    search?: string,
    status?: InvoiceStatus,
  ) {
    return this.repo.findInvoices(pagination, search, status);
  }

  findTimeEntries(
    pagination?: { limit?: number; cursor?: number },
    userId?: number,
  ) {
    return this.repo.findTimeEntries(pagination, userId);
  }

  findRates(type?: RateType) {
    return this.repo.findRates(type);
  }

  async createClient(adminUserId: number, input: AdminCreateClientInput) {
    const client = await this.repo.createClient(input);
    this.audit.log(adminUserId, 'ADMIN_CLIENT_CREATE', 'client', {
      clientId: client.id,
      name: client.name,
    });
    return client;
  }

  async updateClient(
    adminUserId: number,
    id: number,
    input: AdminUpdateClientInput,
  ) {
    const client = await this.repo.updateClient(id, input);
    this.audit.log(adminUserId, 'ADMIN_CLIENT_UPDATE', 'client', {
      clientId: id,
    });
    return client;
  }

  async deleteClient(adminUserId: number, id: number) {
    const result = await this.repo.deleteClient(id);
    this.audit.log(adminUserId, 'ADMIN_CLIENT_DELETE', 'client', {
      clientId: id,
    });
    return result;
  }

  async createProject(adminUserId: number, input: AdminCreateProjectInput) {
    const project = await this.repo.createProject(input);
    this.audit.log(adminUserId, 'ADMIN_PROJECT_CREATE', 'project', {
      projectId: project.id,
      title: project.title,
    });
    return project;
  }

  async updateProject(
    adminUserId: number,
    id: number,
    input: AdminUpdateProjectInput,
  ) {
    const project = await this.repo.updateProject(id, input);
    this.audit.log(adminUserId, 'ADMIN_PROJECT_UPDATE', 'project', {
      projectId: id,
    });
    return project;
  }

  async deleteProject(adminUserId: number, id: number) {
    const result = await this.repo.deleteProject(id);
    this.audit.log(adminUserId, 'ADMIN_PROJECT_DELETE', 'project', {
      projectId: id,
    });
    return result;
  }

  async updateInvoice(
    adminUserId: number,
    id: number,
    input: AdminUpdateInvoiceInput,
  ) {
    const invoice = await this.repo.updateInvoice(id, input);
    this.audit.log(adminUserId, 'ADMIN_INVOICE_UPDATE', 'invoice', {
      invoiceId: id,
    });
    return invoice;
  }

  async deleteInvoice(adminUserId: number, id: number) {
    const result = await this.repo.deleteInvoice(id);
    this.audit.log(adminUserId, 'ADMIN_INVOICE_DELETE', 'invoice', {
      invoiceId: id,
    });
    return result;
  }

  async deleteTimeEntry(adminUserId: number, id: number) {
    const result = await this.repo.deleteTimeEntry(id);
    this.audit.log(adminUserId, 'ADMIN_TIME_ENTRY_DELETE', 'timeEntry', {
      entryId: id,
    });
    return result;
  }

  async createRate(adminUserId: number, input: AdminCreateRateInput) {
    const rate = await this.repo.createRate(input);
    this.audit.log(adminUserId, 'ADMIN_RATE_CREATE', 'rate', {
      rateId: rate.id,
      name: rate.name,
    });
    return rate;
  }

  async updateRate(
    adminUserId: number,
    id: number,
    input: AdminUpdateRateInput,
  ) {
    const rate = await this.repo.updateRate(id, input);
    this.audit.log(adminUserId, 'ADMIN_RATE_UPDATE', 'rate', { rateId: id });
    return rate;
  }

  async deleteRate(adminUserId: number, id: number) {
    const result = await this.repo.deleteRate(id);
    this.audit.log(adminUserId, 'ADMIN_RATE_DELETE', 'rate', { rateId: id });
    return result;
  }
}
