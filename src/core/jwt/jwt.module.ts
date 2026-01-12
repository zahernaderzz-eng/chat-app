import { Module } from '@nestjs/common';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    NestJwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || 'change-me',
        signOptions: {
          expiresIn: config.get<number>('JWT_ACCESS_EXPIRES_IN') || 3600000000000000,
        },
      }),
    }),
  ],
  exports: [NestJwtModule],
})
export class CoreJwtModule {}
