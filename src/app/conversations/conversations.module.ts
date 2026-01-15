import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationService } from './conversations.service';

import { ConversationDeletion } from './entities/conversation-deletion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, ConversationDeletion])],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
