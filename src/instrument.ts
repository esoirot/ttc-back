import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  // Sentry 11: profile every session, running while a traced span is active
  // (replaces profilesSampleRate).
  profileSessionSampleRate: 1.0,
  profileLifecycle: 'trace',
});
