import { PrismaOccupationsRepository } from './prisma-occupations.repository';
import type { PrismaService } from '../../prisma.service';

describe('PrismaOccupationsRepository.update', () => {
  let repo: PrismaOccupationsRepository;
  let prisma: {
    occupation: {
      findFirst: jest.Mock;
      update: jest.Mock<Promise<unknown>, [{ data: object }]>;
    };
  };

  beforeEach(() => {
    prisma = {
      occupation: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, userId: 1 }),
        update: jest
          .fn<Promise<unknown>, [{ data: object }]>()
          .mockResolvedValue({ id: 1 }),
      },
    };
    repo = new PrismaOccupationsRepository(prisma as unknown as PrismaService);
  });

  function sentData() {
    return prisma.occupation.update.mock.calls[0][0].data;
  }

  it('replaces the custom fields when a new list is given', async () => {
    await repo.update(1, 1, {
      id: 1,
      customFields: [{ key: 'Platform', value: 'Upwork' }],
    });

    expect(sentData()).toMatchObject({
      customFields: {
        deleteMany: {},
        createMany: { data: [{ key: 'Platform', value: 'Upwork' }] },
      },
    });
  });

  it('removes every custom field when given an empty list', async () => {
    await repo.update(1, 1, { id: 1, customFields: [] });

    expect(sentData()).toEqual(
      expect.objectContaining({ customFields: { deleteMany: {} } }),
    );
  });

  it('leaves custom fields untouched when they are not part of the update', async () => {
    await repo.update(1, 1, { id: 1, name: 'Renamed' });

    expect(sentData()).not.toHaveProperty('customFields');
  });
});
