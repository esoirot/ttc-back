import { CreateClientInput } from '../dto/create-client.input';
import { UpdateClientInput } from '../dto/update-client.input';
import { CreateCompanyContactInput } from '../dto/create-company-contact.input';
import { UpdateCompanyContactInput } from '../dto/update-company-contact.input';
import { ClientModel, CompanyContactModel } from '../types/client.type';

export interface ClientConnectionModel {
  items: ClientModel[];
  nextCursor: number | null;
  total: number;
}

type PaginationArgs = { limit?: number; cursor?: number };

export abstract class ClientRepository {
  abstract findById(id: number, userId: number): Promise<ClientModel>;
  abstract findByHubspotId(
    userId: number,
    hubspotId: string,
  ): Promise<ClientModel | null>;
  abstract findByHubspotIdGlobal(
    hubspotId: string,
  ): Promise<ClientModel | null>;
  abstract findAll(
    userId: number,
    isAdmin: boolean,
    pagination?: PaginationArgs,
    search?: string,
    clientType?: string,
    excludeStatus?: string,
    status?: string,
  ): Promise<ClientConnectionModel>;
  abstract create(
    userId: number,
    data: CreateClientInput,
  ): Promise<ClientModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateClientInput,
  ): Promise<ClientModel>;
  abstract delete(id: number, userId: number): Promise<ClientModel>;

  abstract createContact(
    data: CreateCompanyContactInput,
    userId: number,
  ): Promise<CompanyContactModel>;
  abstract updateContact(
    id: number,
    userId: number,
    data: UpdateCompanyContactInput,
  ): Promise<CompanyContactModel>;
  abstract deleteContact(
    id: number,
    userId: number,
  ): Promise<CompanyContactModel>;
}
