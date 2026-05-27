import { Injectable } from '@nestjs/common';
import {
  ClientRepository,
  ClientConnectionModel,
} from './repositories/client.repository';
import { AuditService } from '../audit/audit.service';
import { ClientModel, CompanyContactModel } from './types/client.type';
import { CreateClientInput } from './dto/create-client.input';
import { UpdateClientInput } from './dto/update-client.input';
import { CreateCompanyContactInput } from './dto/create-company-contact.input';
import { UpdateCompanyContactInput } from './dto/update-company-contact.input';
import { ClientType } from './entities/client.entity';

@Injectable()
export class ClientsService {
  constructor(
    private readonly repo: ClientRepository,
    private readonly audit: AuditService,
  ) {}

  findAll(
    userId: number,
    isAdmin: boolean,
    pagination?: { limit?: number; cursor?: number },
    search?: string,
    clientType?: ClientType,
  ): Promise<ClientConnectionModel> {
    return this.repo.findAll(userId, isAdmin, pagination, search, clientType);
  }

  findOne(id: number, userId: number): Promise<ClientModel> {
    return this.repo.findById(id, userId);
  }

  findByHubspotIdGlobal(hubspotId: string): Promise<ClientModel | null> {
    return this.repo.findByHubspotIdGlobal(hubspotId);
  }

  async create(userId: number, input: CreateClientInput): Promise<ClientModel> {
    const client = await this.repo.create(userId, input);
    this.audit.log(userId, 'CLIENT_CREATE', 'client', {
      clientId: client.id,
      name: client.name,
    });
    return client;
  }

  async update(
    id: number,
    userId: number,
    input: UpdateClientInput,
  ): Promise<ClientModel> {
    const client = await this.repo.update(id, userId, input);
    this.audit.log(userId, 'CLIENT_UPDATE', 'client', {
      clientId: client.id,
      name: client.name,
    });
    return client;
  }

  async importFromHubspot(
    userId: number,
    hubspotId: string,
    props: {
      name: string;
      email?: string;
      phone?: string;
      company?: string;
    },
  ): Promise<ClientModel> {
    const existing = await this.repo.findByHubspotId(userId, hubspotId);
    if (existing) return existing;
    return this.repo.create(userId, { ...props, hubspotId });
  }

  async delete(id: number, userId: number): Promise<boolean> {
    await this.repo.delete(id, userId);
    this.audit.log(userId, 'CLIENT_DELETE', 'client', { clientId: id });
    return true;
  }

  createContact(
    userId: number,
    input: CreateCompanyContactInput,
  ): Promise<CompanyContactModel> {
    return this.repo.createContact(input, userId);
  }

  updateContact(
    id: number,
    userId: number,
    input: UpdateCompanyContactInput,
  ): Promise<CompanyContactModel> {
    return this.repo.updateContact(id, userId, input);
  }

  async deleteContact(id: number, userId: number): Promise<boolean> {
    await this.repo.deleteContact(id, userId);
    return true;
  }
}
