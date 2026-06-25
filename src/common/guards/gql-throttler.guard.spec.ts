import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './gql-throttler.guard';

const makeContext = (type: string, gqlCtx: unknown) =>
  ({
    getType: jest.fn().mockReturnValue(type),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(null),
      getResponse: jest.fn().mockReturnValue(null),
    }),
    _gqlCtx: gqlCtx,
  }) as unknown as ExecutionContext;

jest.mock('@nestjs/graphql', () => ({
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

describe('GqlThrottlerGuard', () => {
  let guard: GqlThrottlerGuard;
  let superCanActivate: jest.SpyInstance;
  let mockGqlCreate: jest.SpyInstance;

  beforeEach(() => {
    guard = new GqlThrottlerGuard(
      {} as ConstructorParameters<typeof GqlThrottlerGuard>[0],
      {} as ConstructorParameters<typeof GqlThrottlerGuard>[1],
      {} as ConstructorParameters<typeof GqlThrottlerGuard>[2],
    );
    mockGqlCreate = jest.spyOn(GqlExecutionContext, 'create');
    // stub super.canActivate so we don't need ThrottlerGuard's full setup
    superCanActivate = jest
      .spyOn(ThrottlerGuard.prototype, 'canActivate')
      .mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('canActivate', () => {
    it('returns true for WS subscription (graphql context, no req)', async () => {
      const ctx = makeContext('graphql', { req: undefined });
      mockGqlCreate.mockReturnValue({ getContext: () => ({ req: undefined }) });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('delegates to super for graphql context with req present', async () => {
      const mockReq = { ip: '1.2.3.4', cookies: {}, headers: {} };
      const ctx = makeContext('graphql', { req: mockReq });
      mockGqlCreate.mockReturnValue({ getContext: () => ({ req: mockReq }) });

      await guard.canActivate(ctx);

      expect(superCanActivate).toHaveBeenCalledWith(ctx);
    });

    it('delegates to super for http context', async () => {
      const ctx = makeContext('http', {});
      mockGqlCreate.mockReturnValue({ getContext: () => ({}) });

      await guard.canActivate(ctx);

      expect(superCanActivate).toHaveBeenCalledWith(ctx);
    });
  });

  describe('getRequestResponse', () => {
    it('returns req/res from GraphQL context when present', () => {
      const mockReq = { ip: '1.2.3.4', cookies: {}, headers: {} };
      const mockRes = { header: jest.fn() };
      const ctx = makeContext('graphql', {});
      mockGqlCreate.mockReturnValue({
        getContext: () => ({ req: mockReq, res: mockRes }),
      });

      const result = guard.getRequestResponse(ctx);

      expect(result.req).toBe(mockReq);
      expect(result.res).toBe(mockRes);
    });

    it('falls back to noopRes when GraphQL context has no res', () => {
      const mockReq = { ip: '1.2.3.4', cookies: {}, headers: {} };
      const ctx = makeContext('graphql', {});
      mockGqlCreate.mockReturnValue({
        getContext: () => ({ req: mockReq, res: undefined }),
      });

      const { res } = guard.getRequestResponse(ctx);

      // noopRes.header is a noop function
      expect(typeof res.header).toBe('function');
    });

    it('falls back to HTTP req/res when no GraphQL req', () => {
      const mockReq = { ip: '1.2.3.4', cookies: {}, headers: {} };
      const mockRes = { header: jest.fn() };
      const ctx = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockReq),
          getResponse: jest.fn().mockReturnValue(mockRes),
        }),
      } as unknown as ExecutionContext;
      mockGqlCreate.mockReturnValue({ getContext: () => ({}) });

      const result = guard.getRequestResponse(ctx);

      expect(result.req).toBe(mockReq);
    });
  });
});
