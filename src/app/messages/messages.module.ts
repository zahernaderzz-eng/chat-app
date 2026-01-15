import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { ConversationModule } from '@app/conversations/conversations.module';
import { MessagesService } from './messages.service';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), ConversationModule],

  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessageModule {}
