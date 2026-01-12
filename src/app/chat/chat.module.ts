import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { WsJwtAuthGuard } from '@app/auth/guards/ws-jwt-auth.guard';
import { AuthModule } from '@app/auth/auth.module';
import { ConversationModule } from '@app/conversations/conversations.module';

@Module({
  imports: [AuthModule, ConversationModule],
  providers: [ChatGateway, WsJwtAuthGuard],
})
export class ChatModule {}
