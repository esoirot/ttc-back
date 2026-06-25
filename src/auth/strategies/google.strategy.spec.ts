import { ConfigService } from '@nestjs/config';
import type { Profile } from 'passport-google-oauth20';
import { GoogleStrategy } from './google.strategy';

jest.mock('passport-google-oauth20', () => ({
  Strategy: class {
    constructor() {}
  },
  Profile: class {},
}));

const makeProfile = (overrides: Partial<Profile> = {}): Profile =>
  ({
    id: 'g-123',
    displayName: 'Test User',
    emails: [{ value: 'user@gmail.com' }],
    ...overrides,
  }) as unknown as Profile;

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;
  let configService: { getOrThrow: jest.Mock };

  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          GOOGLE_CLIENT_ID: 'client-id',
          GOOGLE_CLIENT_SECRET: 'client-secret',
          GOOGLE_CALLBACK_URL: 'http://localhost/auth/google/callback',
        };
        return map[key] ?? '';
      }),
    };
    strategy = new GoogleStrategy(configService as unknown as ConfigService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('validate — extracts providerId, email, name from profile', () => {
    const profile = makeProfile();

    const result = strategy.validate('access', 'refresh', profile);

    expect(result).toEqual({
      providerId: 'g-123',
      email: 'user@gmail.com',
      name: 'Test User',
    });
  });

  it('validate — uses first email from emails array', () => {
    const profile = makeProfile({
      emails: [
        { value: 'primary@gmail.com', verified: true },
        { value: 'secondary@gmail.com', verified: true },
      ],
    });

    const result = strategy.validate('access', 'refresh', profile);

    expect(result.email).toBe('primary@gmail.com');
  });
});
