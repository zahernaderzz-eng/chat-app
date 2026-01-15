import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { WsJwtAuthGuard } from '@app/auth/guards/ws-jwt-auth.guard';
import { AuthModule } from '@app/auth/auth.module';
import { ConversationModule } from '@app/conversations/conversations.module';
import { MessageModule } from '@app/messages/messages.module';
import { ChatAuthService } from './services/chat-auth.service';
import { ChatSocketService } from './services/chat-socket.service';
import { ConversationHelperService } from './services/conversation-helper.service';

@Module({
  imports: [AuthModule, ConversationModule, MessageModule],
  providers: [
    ChatGateway,
    WsJwtAuthGuard,
    ChatAuthService,
    ChatSocketService,
    ConversationHelperService,
  ],
})
export class ChatModule {}
