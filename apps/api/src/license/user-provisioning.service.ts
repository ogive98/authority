import { Injectable } from '@nestjs/common';
import { LicenseService } from './license.service';

@Injectable()
export class UserProvisioningService {
  constructor(private readonly licenseService: LicenseService) {}

  async assertCanCreateUser(): Promise<void> {
    await this.licenseService.assertCanAddUser();
  }
}
