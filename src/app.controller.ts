import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // REMOVE AFTER TEST IS DONE
  @Get('debug-sentry')
  getError() {
    throw new Error('My first Sentry error!');
  }
}
