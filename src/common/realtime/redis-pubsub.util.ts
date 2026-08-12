import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';

const REDIS_PUBSUB_OPTIONS: RedisOptions = {
  autoResubscribe: true,
  enableReadyCheck: true,
  // Back off up to 5s between reconnect attempts.
  retryStrategy: (times: number) => Math.min(times * 200, 5_000),
};

interface RedisClientPair {
  publisher: Redis;
  subscriber: Redis;
}

/**
 * Builds one Redis client per role (ioredis requires a client in subscriber
 * mode to be dedicated — it can't also issue other commands). Called once per
 * *service* instance, not shared as a singleton across services: each caller
 * owns its own pair. Order matters — publisher first, then subscriber — tests
 * that mock `ioredis` and capture instances by construction order depend on it.
 */
export function createRedisClientPair(config: ConfigService): RedisClientPair {
  const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const publisher = new Redis(url, REDIS_PUBSUB_OPTIONS);
  const subscriber = new Redis(url, REDIS_PUBSUB_OPTIONS);
  return { publisher, subscriber };
}
