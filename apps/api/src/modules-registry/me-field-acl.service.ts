import { Injectable } from '@nestjs/common';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { PermissionService } from '../permissions/permission.service';
import { ModuleRegistryService } from './module-registry.service';

export type FieldAclEntry = {
  key: string;
  permissionKey: string;
  visible: boolean;
};

export type MeFieldAclResponse = {
  companyId: string | null;
  fields: FieldAclEntry[];
};

/**
 * Field ACL catalogue for chrome (UI-11).
 * UI hides; PermissionService still refuses on the API.
 * SPECTRE is not consulted — never a bypass.
 */
export const FIELD_ACL_CATALOG: {
  key: string;
  permissionKey: string;
}[] = [{ key: 'hr.wage', permissionKey: PERMISSION_KEYS.hrWageRead }];

@Injectable()
export class MeFieldAclService {
  constructor(
    private readonly moduleRegistry: ModuleRegistryService,
    private readonly permissions: PermissionService,
  ) {}

  async buildForUser(
    userId: string,
    headers: Record<string, string | string[] | undefined>,
    cookies: Record<string, string | undefined>,
  ): Promise<MeFieldAclResponse> {
    const companyId = await this.moduleRegistry.resolveCompanyId(
      userId,
      headers,
      cookies,
    );

    const fields: FieldAclEntry[] = [];
    for (const entry of FIELD_ACL_CATALOG) {
      const visible = await this.permissions.evaluate(
        userId,
        entry.permissionKey,
        { companyId: companyId ?? undefined },
      );
      fields.push({
        key: entry.key,
        permissionKey: entry.permissionKey,
        visible,
      });
    }

    return { companyId, fields };
  }
}
