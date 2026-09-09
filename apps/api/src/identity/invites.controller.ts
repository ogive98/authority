import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { AcceptInviteDto } from './users.dto';
import { InviteService } from './invite.service';

@Controller('api/v1/identity/invites')
export class InvitesController {
  constructor(private readonly invites: InviteService) {}

  @Get(':token')
  peek(@Param('token') token: string) {
    return this.invites.peek(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  accept(@Param('token') token: string, @Body() dto: AcceptInviteDto) {
    return this.invites.accept(token, dto.password);
  }
}
