import { Test, TestingModule } from '@nestjs/testing';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';

type AuthRequest = Parameters<GoogleCalendarController['getStatus']>[0];

const makeReq = (userId = 1) =>
  ({
    user: { id: userId, email: 'u@e.com', role: 'USER' },
  }) as unknown as AuthRequest;

describe('GoogleCalendarController', () => {
  let controller: GoogleCalendarController;
  let service: Record<string, jest.Mock | string>;

  beforeEach(async () => {
    service = {
      buildAuthUrl: jest
        .fn()
        .mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?...'),
      handleCallback: jest.fn().mockResolvedValue(undefined),
      callbackRedirectUrl: 'http://localhost:5173/google-calendar',
      getStatus: jest
        .fn()
        .mockResolvedValue({ connected: true, email: 'u@gmail.com' }),
      disconnect: jest.fn().mockResolvedValue(undefined),
      listEvents: jest.fn().mockResolvedValue({ items: [] }),
      createEvent: jest.fn().mockResolvedValue({ id: 'e-new' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleCalendarController],
      providers: [{ provide: GoogleCalendarService, useValue: service }],
    }).compile();

    controller = module.get(GoogleCalendarController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('initiateOAuth — returns redirect URL', () => {
    const result = controller.initiateOAuth(makeReq());
    expect(service.buildAuthUrl).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({ statusCode: 302 });
  });

  it('oauthCallback — calls handleCallback and redirects', async () => {
    const result = await controller.oauthCallback('code-abc', 'state-xyz');
    expect(service.handleCallback).toHaveBeenCalledWith(
      'code-abc',
      'state-xyz',
    );
    expect(result).toMatchObject({ statusCode: 302 });
  });

  it('getStatus — delegates with userId', async () => {
    await controller.getStatus(makeReq());
    expect(service.getStatus).toHaveBeenCalledWith(1);
  });

  it('disconnect — delegates with userId', async () => {
    await controller.disconnect(makeReq());
    expect(service.disconnect).toHaveBeenCalledWith(1);
  });

  it('listEvents — passes userId and time range', async () => {
    await controller.listEvents(
      makeReq(),
      '2026-01-01T00:00:00Z',
      '2026-02-01T00:00:00Z',
    );
    expect(service.listEvents).toHaveBeenCalledWith(
      1,
      '2026-01-01T00:00:00Z',
      '2026-02-01T00:00:00Z',
    );
  });

  it('createEvent — passes userId and dto', async () => {
    const dto = {
      summary: 'Call',
      startDateTime: '2026-01-01T10:00:00Z',
      endDateTime: '2026-01-01T11:00:00Z',
    };
    await controller.createEvent(makeReq(), dto);
    expect(service.createEvent).toHaveBeenCalledWith(1, dto);
  });
});
