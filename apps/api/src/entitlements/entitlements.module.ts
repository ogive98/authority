import { Module } from '@nestjs/common';
import { LicenseModule } from '../license/license.module';
import { EntitlementEvaluatorService } from './entitlement-evaluator.service';

@Module({
  imports: [LicenseModule],
  providers: [EntitlementEvaluatorService],
  exports: [EntitlementEvaluatorService],
})
export class EntitlementsModule {}
