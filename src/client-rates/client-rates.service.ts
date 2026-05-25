import { Injectable } from '@nestjs/common';
import { ClientRateRepository } from './repositories/client-rate.repository';
import { ClientRateModel } from './types/client-rate.type';
import { CreateClientRateInput } from './dto/create-client-rate.input';
import { UpdateClientRateInput } from './dto/update-client-rate.input';

@Injectable()
export class ClientRatesService {
  constructor(private readonly repo: ClientRateRepository) {}

  findByClient(userId: number, clientId: number): Promise<ClientRateModel[]> {
    return this.repo.findByClient(userId, clientId);
  }

  findOne(id: number, userId: number): Promise<ClientRateModel> {
    return this.repo.findById(id, userId);
  }

  create(
    userId: number,
    input: CreateClientRateInput,
  ): Promise<ClientRateModel> {
    return this.repo.create(userId, input);
  }

  update(
    id: number,
    userId: number,
    input: UpdateClientRateInput,
  ): Promise<ClientRateModel> {
    return this.repo.update(id, userId, input);
  }

  async delete(id: number, userId: number): Promise<boolean> {
    await this.repo.delete(id, userId);
    return true;
  }
}
