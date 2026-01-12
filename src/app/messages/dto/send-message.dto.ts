import { MessageType } from '@common/enums/message-type.enum';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { MessageMetadataDto } from './message-metadata.dto';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @IsUUID()
  conversationId: string;

  @IsEnum(MessageType)
  type: MessageType;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MessageMetadataDto)
  metadata?: MessageMetadataDto;
}
