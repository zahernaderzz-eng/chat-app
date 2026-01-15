import { IsUUID, IsNotEmpty, IsEnum } from 'class-validator';

export enum DeleteType {
  FOR_ME = 'forMe',
  FOR_ALL = 'forAll',
}

export class DeleteMessageDto {
  @IsUUID()
  @IsNotEmpty()
  messageId: string;

  @IsEnum(DeleteType)
  @IsNotEmpty()
  deleteType: DeleteType;
}
