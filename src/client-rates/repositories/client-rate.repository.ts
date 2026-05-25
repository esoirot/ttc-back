import { CreateClientRateInput } from '../dto/create-client-rate.input';
import { UpdateClientRateInput } from '../dto/update-client-rate.input';
import { ClientRateModel } from '../types/client-rate.type';

export abstract class ClientRateRepository {
  abstract findByClient(
    userId: number,
    clientId: number,
  ): Promise<ClientRateModel[]>;
  abstract findById(id: number, userId: number): Promise<ClientRateModel>;
  abstract create(
    userId: number,
    data: CreateClientRateInput,
  ): Promise<ClientRateModel>;
  abstract update(
    id: number,
    userId: number,
    data: UpdateClientRateInput,
  ): Promise<ClientRateModel>;
  abstract delete(id: number, userId: number): Promise<void>;
}
