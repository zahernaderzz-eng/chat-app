import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { MessageType } from '@common/enums/message-type.enum';

export class SendMessageSocketDto {
  @IsUUID()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
