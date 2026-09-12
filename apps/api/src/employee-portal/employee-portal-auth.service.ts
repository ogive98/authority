import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import {
  HrEmployeeStatus,
  IamSessionRealm,
  type HrEmployee,
} from '@prisma/client';
import { AuthService, type LoginResult } from '../identity/auth.service';
import { IDENTITY_ERROR_CODES } from '../identity/identity.constants';
import { IdentityException } from '../identity/identity.exception';
import { SessionService } from '../identity/session.service';
import { ModuleRegistryService } from '../modules-registry/module-registry.service';
import { MODULE_ERROR_CODES } from '../modules-registry/modules.constants';
import { HrService } from '../hr/hr.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMPLOYEE_PORTAL_DEFAULTS,
  EMPLOYEE_PORTAL_ERROR_CODES,
} from './employee-portal.constants';
import { EmployeePortalException } from './employee-portal.exception';
import {
  toPortalProfile,
  type PortalEmployeeProfile,
} from './employee-portal-profile.mapper';

export type EmployeePortalLink = {
  employeeId: string;
  companyId: string;
  matricule: string;
  displayName: string;
  status: HrEmployeeStatus;
};

export type EmployeePortalLoginResult = LoginResult & {
  employee: EmployeePortalLink;
};

@Injectable()
export class EmployeePortalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly moduleRegistry: ModuleRegistryService,
    private readonly hr: HrService,
  ) {}

  async login(params: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
  }): Promise<EmployeePortalLoginResult> {
    const user = await this.authService.authenticatePassword(params);
    const employee = await this.requireLinkedEmployee(user.id);

    if (
      !(await this.moduleRegistry.isEnabled(employee.companyId, 'portals'))
    ) {
      throw new ForbiddenException({
        code: MODULE_ERROR_CODES.DISABLED,
        message: 'Module is disabled.',
      });
    }
    if (
      !(await this.moduleRegistry.isEnabled(employee.companyId, 'attendance'))
    ) {
      throw new ForbiddenException({
        code: MODULE_ERROR_CODES.DISABLED,
        message: 'Module is disabled.',
      });
    }

    await this.prisma.iamLoginAttempt.create({
      data: {
        userId: user.id,
        email: user.email,
        ip: params.ip,
        success: true,
      },
    });

    const { session, token } = await this.sessionService.createSession({
      userId: user.id,
      ip: params.ip,
      userAgent: params.userAgent,
      realm: IamSessionRealm.EMPLOYEE_PORTAL,
      ttlMs: EMPLOYEE_PORTAL_DEFAULTS.sessionTtlHours * 60 * 60 * 1000,
    });

    return {
      user: this.authService.toMeResponse(user),
      session: { id: session.id, expiresAt: session.expiresAt },
      token,
      employee: this.toLink(employee),
    };
  }

  async findLinkedEmployee(userId: string): Promise<HrEmployee | null> {
    return this.prisma.hrEmployee.findFirst({
      where: {
        userId,
        deletedAt: null,
        status: HrEmployeeStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async requireLinkedEmployee(userId: string): Promise<HrEmployee> {
    const employee = await this.findLinkedEmployee(userId);
    if (!employee) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return employee;
  }

  async getMe(userId: string): Promise<{
    user: ReturnType<AuthService['toMeResponse']>;
    employee: EmployeePortalLink;
    profile: PortalEmployeeProfile;
    realm: 'employee_portal';
  }> {
    const employee = await this.requireLinkedEmployee(userId);
    const user = await this.prisma.iamUser.findUniqueOrThrow({
      where: { id: userId },
    });

    if (
      !(await this.moduleRegistry.isEnabled(employee.companyId, 'portals')) ||
      !(await this.moduleRegistry.isEnabled(employee.companyId, 'attendance'))
    ) {
      throw new EmployeePortalException(
        EMPLOYEE_PORTAL_ERROR_CODES.FORBIDDEN,
        'Employee portal is not available.',
        HttpStatus.FORBIDDEN,
      );
    }

    const full = await this.hr.getEmployee(
      employee.companyId,
      employee.id,
      false,
    );

    return {
      user: this.authService.toMeResponse(user),
      employee: this.toLink(employee),
      profile: toPortalProfile(full),
      realm: 'employee_portal' as const,
    };
  }

  toLink(employee: HrEmployee): EmployeePortalLink {
    return {
      employeeId: employee.id,
      companyId: employee.companyId,
      matricule: employee.matricule,
      displayName: employee.displayName,
      status: employee.status,
    };
  }
}
