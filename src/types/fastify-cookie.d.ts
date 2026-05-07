import type { CookieSerializeOptions } from '@fastify/cookie';

declare module 'fastify' {
  interface FastifyRequest {
    cookies: { [cookieName: string]: string | undefined };
  }

  interface FastifyReply {
    setCookie(
      name: string,
      value: string,
      options?: CookieSerializeOptions,
    ): this;
    clearCookie(name: string, options?: CookieSerializeOptions): this;
  }
}
