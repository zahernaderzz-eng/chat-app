import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtTokenService } from '@app/auth/services/jwt-token.service';
import { UseGuards } from '@nestjs/common';
import { WsJwtAuthGuard } from '@app/auth/guards/ws-jwt-auth.guard';
import { WsUser } from '@common/decorators/ws-user.decorator';
import { ConversationService } from '@app/conversations/conversations.service';

interface SendMessagePayload {
  to?: string; // recipient userId for one-to-one
  conversationId?: string; // optional room id
  content: string;
  [key: string]: any;
}
@UseGuards(WsJwtAuthGuard)
@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly conversationService: ConversationService) {}

  handleConnection(client: Socket) {
    // add socket id to user's set
    const set = this.userSockets.get(client.data.userId) ?? new Set<string>();
    set.add(client.id);
    this.userSockets.set(client.data.userId, set);

    console.log(`Client connected: ${client.id}, userId=${client.data.userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      const set = this.userSockets.get(userId);
      if (set) {
        set.delete(client.id);
        if (set.size === 0) this.userSockets.delete(userId);
        else this.userSockets.set(userId, set);
      }
    }

    console.log(
      `Client disconnected: ${client.id}, userId=${client.data?.userId}`,
    );
  }

  @SubscribeMessage('startConversation')
  async startConversation(
    @WsUser('userId') userId: string,
    @MessageBody() body: { toUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const conversation = await this.conversationService.getOrCreateConversation(
      userId,
      body.toUserId,
    );

    client.join(conversation.id);

    client.emit('conversationStarted', conversation);
  }

  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @WsUser('userId') userId: string,
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data.conversationId) {
      client.emit('error', 'conversationId is required');
      return;
    }

    client.join(data.conversationId);

    console.log(`User ${userId} joined conversation ${data.conversationId}`);

    client.to(data.conversationId).emit('userJoined', {
      userId,
    });
  }

  @SubscribeMessage('sendMessage')
  handleSendMessage(
    @WsUser('userId') userId: string,
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const from = userId;
    console.log('FROM:', from);
    console.log('PAYLOAD:', payload);

    if (!from) {
      client.emit('error', 'Unauthorized: missing sender userId');
      return;
    }

    if (payload.conversationId) {
      const room = payload.conversationId;
      const message = {
        from,
        conversationId: room,
        content: payload.content,
        metadata: payload.metadata ?? null,
      };
      this.server.to(room).emit('conversationMessage', message);
      return;
    }

    client.emit('error', {
      message: 'sendMessage payload must include `to` or `conversationId`',
    });
  }
}
