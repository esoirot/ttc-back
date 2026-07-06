import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  getHello(): string {
    return this.appService.getHello();
  }

  // REMOVE AFTER TEST IS DONE
  @Get('debug-sentry')
  @ApiExcludeEndpoint()
  getError() {
    throw new Error('My first Sentry error!');
  }
}
