import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { ConversationModule } from '@app/conversations/conversations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    forwardRef(() => ConversationModule),
  ],
})
export class MessageModule {}
