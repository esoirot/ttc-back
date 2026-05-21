import { Global, Module } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

export const PUB_SUB = 'PUB_SUB';

const createRedisPubSub = () => {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const publisher = new Redis(url);
  const subscriber = new Redis(url);
  return new RedisPubSub({ publisher, subscriber });
};

@Global()
@Module({
  providers: [{ provide: PUB_SUB, useFactory: createRedisPubSub }],
  exports: [PUB_SUB],
})
export class PubSubModule {}
