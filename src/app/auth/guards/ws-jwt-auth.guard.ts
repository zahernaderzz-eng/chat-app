import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Socket } from 'socket.io';
import { JwtTokenService } from '@app/auth/services/jwt-token.service';

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();

    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    try {
      const payload = this.jwtTokenService.verifyAccessToken(token);

      client.data.user = payload;
      client.data.userId = payload.userId;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid socket token');
    }
  }
}
