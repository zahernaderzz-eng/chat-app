import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ChatAuthService {
  constructor(private readonly jwtService: JwtService) {}

  verifySocketToken(client: Socket): string {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Authentication required');
    }

    const payload = this.jwtService.verify(token as string);
    const userId = (payload as any).sub || (payload as any).userId;

    if (!userId) {
      throw new Error('Invalid token');
    }

    return userId;
  }
}
