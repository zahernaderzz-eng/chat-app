import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationService } from './conversations.service';
import { MessageModule } from '@app/messages/messages.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation]),
    forwardRef(() => MessageModule),
  ],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
