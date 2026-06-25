import { Test, TestingModule } from '@nestjs/testing';
import { ClientRatesResolver } from './client-rates.resolver';
import { ClientRatesService } from './client-rates.service';
import { mockClientRate } from '../__test-helpers__/mock-factories';

describe('ClientRatesResolver', () => {
  let resolver: ClientRatesResolver;
  let service: {
    findByClient: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const user = { id: 1, role: 'USER' };

  beforeEach(async () => {
    service = {
      findByClient: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientRatesResolver,
        { provide: ClientRatesService, useValue: service },
      ],
    }).compile();

    resolver = module.get<ClientRatesResolver>(ClientRatesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('findByClient — delegates with user id and client id', async () => {
    const rates = [mockClientRate()];
    service.findByClient.mockResolvedValue(rates);

    const result = await resolver.findByClient(user, 3);
    expect(service.findByClient).toHaveBeenCalledWith(1, 3);
    expect(result).toEqual(rates);
  });

  it('createClientRate — delegates to service', async () => {
    const rate = mockClientRate();
    service.create.mockResolvedValue(rate);

    const result = await resolver.createClientRate(
      {
        clientId: 1,
        name: 'Rate',
        amount: 0.12,
        type: 'PER_WORD',
        currency: 'EUR',
      },
      user,
    );
    expect(service.create).toHaveBeenCalledWith(1, expect.any(Object));
    expect(result).toEqual(rate);
  });

  it('updateClientRate — delegates with id from input', async () => {
    const rate = mockClientRate({ amount: 0.15 });
    service.update.mockResolvedValue(rate);

    const result = await resolver.updateClientRate(
      { id: 1, amount: 0.15 },
      user,
    );
    expect(service.update).toHaveBeenCalledWith(1, 1, { id: 1, amount: 0.15 });
    expect(result).toEqual(rate);
  });

  it('deleteClientRate — delegates to service', async () => {
    service.delete.mockResolvedValue(true);

    const result = await resolver.deleteClientRate(1, user);
    expect(service.delete).toHaveBeenCalledWith(1, 1);
    expect(result).toBe(true);
  });
});
