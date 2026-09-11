import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WaWebhookService } from './wa-webhook.service';

/**
 * Public Meta WhatsApp Cloud webhook (D206).
 * No session — verify token (GET) + HMAC app_secret (POST). Prefs empty until human.
 */
@Controller('api/v1/webhooks/whatsapp')
export class WaWebhookController {
  constructor(private readonly webhooks: WaWebhookService) {}

  @Get(':companyId')
  async verify(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() res: Response,
  ) {
    const body = await this.webhooks.verifySubscribe(
      companyId,
      mode,
      token,
      challenge,
    );
    res.status(200).contentType('text/plain; charset=utf-8').send(body);
  }

  @Post(':companyId')
  @HttpCode(200)
  @Header('Content-Type', 'application/json')
  ingest(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const signature = req.headers['x-hub-signature-256'];
    const header = Array.isArray(signature) ? signature[0] : signature;
    return this.webhooks.ingest(companyId, req.rawBody, header);
  }
}
