import { Module } from '@nestjs/common';
import { OAuthTokenRefreshService } from './oauth-token-refresh.service';

@Module({
  providers: [OAuthTokenRefreshService],
  exports: [OAuthTokenRefreshService],
})
export class OAuthTokenModule {}
