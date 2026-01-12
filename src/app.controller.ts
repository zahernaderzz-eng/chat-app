import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from '@common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Post('test')
  test() {
    return 'App Check Passed ';
  }
}
