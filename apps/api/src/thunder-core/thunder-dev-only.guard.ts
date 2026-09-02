import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class ThunderDevOnlyGuard implements CanActivate {
  canActivate(): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return true;
  }
}
