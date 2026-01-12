import { Module } from '@nestjs/common';
import { JwtTokenService } from './services/jwt-token.service';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';

@Module({
  providers: [JwtTokenService, WsJwtAuthGuard],
  exports: [JwtTokenService, WsJwtAuthGuard],
})
export class AuthModule {}
