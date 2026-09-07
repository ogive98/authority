import { Injectable, OnModuleInit } from '@nestjs/common';
import { AdapterRegistryService } from './adapter.registry';
import { ControlEntitlementsAdapterStub } from './stubs/control-entitlements.adapter';
import { WebhookEchoAdapterStub } from './stubs/webhook-echo.adapter';

@Injectable()
export class ThunderAdaptersRegistrar implements OnModuleInit {
  constructor(private readonly adapters: AdapterRegistryService) {}

  onModuleInit(): void {
    this.adapters.register(new ControlEntitlementsAdapterStub());
    this.adapters.register(new WebhookEchoAdapterStub());
  }
}
