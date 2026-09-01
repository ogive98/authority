import './load-env';
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, IdentityModule],
})
export class AppModule {}
