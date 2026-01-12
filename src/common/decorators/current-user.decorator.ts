import { JwtPayload } from '@app/auth/interfaces/jwt-payload.interface';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (key: keyof JwtPayload | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    console.log('Request user:', request.user);
    const user = request.user as JwtPayload;
    if (!user) return null;
    return key ? user[key] : user;
  },
);
