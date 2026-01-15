import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageDeletion } from './entities/message-deletion.entity';
import { MessagesService } from './messages.service';

import { ConversationModule } from '@app/conversations/conversations.module';
import { UploadsModule } from '@app/uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageDeletion]),
    ConversationModule,
    UploadsModule,
  ],

  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessageModule {}
