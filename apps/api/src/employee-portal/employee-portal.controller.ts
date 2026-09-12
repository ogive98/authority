import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AttAbsenceStatus, IamSessionRealm } from '@prisma/client';
import type { Request, Response } from 'express';
import { AttendanceService } from '../attendance/attendance.service';
import { BulletinPdfService } from '../hr/bulletin-pdf.service';
import { BulletinService } from '../hr/bulletin.service';
import { HrDocumentService } from '../hr/hr-document.service';
import { HrService } from '../hr/hr.service';
import { LoginDto } from '../identity/login.dto';
import { SessionService } from '../identity/session.service';
import { RequireModule } from '../modules-registry/modules.decorators';
import { toPortalBulletin } from './employee-portal-bulletin.mapper';
import {
  EMPLOYEE_PORTAL_COOKIE_NAME,
  EMPLOYEE_PORTAL_ERROR_CODES,
} from './employee-portal.constants';
import { PortalCreateAbsenceDto, PortalPatchBankDto } from './employee-portal.dto';
import { EmployeePortalAuthService } from './employee-portal-auth.service';
import { EmployeePortalModuleGuard } from './employee-portal-module.guard';
import {
  EmployeePortalSessionGuard,
  type EmployeePortalRequest,
} from './employee-portal-session.guard';
import {
  toPortalDocument,
  toPortalProfile,
  type PortalDashboard,
} from './employee-portal-profile.mapper';
import { EmployeePortalException } from './employee-portal.exception';

@Controller('api/v1/employee-portal')
export class EmployeePortalController {
  constructor(
    private readonly portalAuthService: EmployeePortalAuthService,
    private readonly attendance: AttendanceService,
    private readonly bulletin: BulletinService,
    private readonly bulletinPdf: BulletinPdfService,
    private readonly hrDocuments: HrDocumentService,
    private readonly hr: HrService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.portalAuthService.login({
      email: dto.email,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setSessionCookie(res, result.token, result.session.expiresAt);
    return {
      user: result.user,
      employee: result.employee,
      realm: 'employee_portal',
    };
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[EMPLOYEE_PORTAL_COOKIE_NAME] as
      | string
      | undefined;

    if (token) {
      const session = await this.sessionService.findActiveSession(
        token,
        IamSessionRealm.EMPLOYEE_PORTAL,
      );
      if (session) {
        await this.sessionService.revokeSession(session.id, session.userId);
      }
    }

    res.clearCookie(EMPLOYEE_PORTAL_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  async me(@Req() req: EmployeePortalRequest) {
    return this.portalAuthService.getMe(req.user!.id);
  }

  /** D232 — update own bank coords (RIB TN checksum). */
  @Patch('me/bank')
  @RequireModule('hr')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  async patchBank(
    @Req() req: EmployeePortalRequest,
    @Body() dto: PortalPatchBankDto,
  ) {
    const updated = await this.hr.patchEmployee(
      req.companyId!,
      req.employeeId!,
      {
        bankName: dto.bankName,
        bankAgency: dto.bankAgency,
        bankAccount: dto.bankAccount,
      },
      false,
    );
    return { profile: toPortalProfile(updated) };
  }

  /** D231 — Accueil KPI (own only). */
  @Get('dashboard')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  async dashboard(
    @Req() req: EmployeePortalRequest,
  ): Promise<PortalDashboard> {
    const companyId = req.companyId!;
    const employeeId = req.employeeId!;

    const [absences, docs, bulletins] = await Promise.all([
      this.attendance.listAbsences(companyId, { employeeId }),
      this.moduleHrDocs(companyId, employeeId),
      this.moduleBulletins(companyId, employeeId),
    ]);

    const pendingAbsences = absences.filter(
      (a) => a.status === AttAbsenceStatus.REQUESTED,
    ).length;
    const approvedAbsences = absences.filter(
      (a) => a.status === AttAbsenceStatus.APPROVED,
    ).length;
    const last = bulletins[0] ?? null;

    return {
      pendingAbsences,
      approvedAbsences,
      documentCount: docs,
      lastBulletin: last
        ? {
            id: last.id,
            number: last.number,
            periodYm: last.periodYm,
            netPay: last.netPay,
            currency: last.currency,
          }
        : null,
    };
  }

  @Get('absences')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  listAbsences(@Req() req: EmployeePortalRequest) {
    return this.attendance.listAbsences(req.companyId!, {
      employeeId: req.employeeId!,
    });
  }

  @Get('calendar')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  calendar(
    @Req() req: EmployeePortalRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendance.getCalendar(req.companyId!, {
      employeeId: req.employeeId!,
      from,
      to,
    });
  }

  @Post('absences')
  @HttpCode(201)
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  createAbsence(
    @Req() req: EmployeePortalRequest,
    @Body() dto: PortalCreateAbsenceDto,
  ) {
    return this.attendance.createAbsence(
      req.companyId!,
      {
        employeeId: req.employeeId!,
        type: dto.type,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason,
        notes: dto.notes,
      },
      req.user!.id,
    );
  }

  /** D231 — cancel own REQUESTED only (canManage=false). */
  @Post('absences/:id/cancel')
  @HttpCode(200)
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  async cancelAbsence(
    @Req() req: EmployeePortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const list = await this.attendance.listAbsences(req.companyId!, {
      employeeId: req.employeeId!,
    });
    const own = list.find((a) => a.id === id);
    if (!own) {
      throw new EmployeePortalException(
        EMPLOYEE_PORTAL_ERROR_CODES.NOT_FOUND,
        'Absence not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.attendance.cancelAbsence(
      req.companyId!,
      id,
      req.user!.id,
      false,
    );
  }

  @Get('documents')
  @RequireModule('hr')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  async listDocuments(@Req() req: EmployeePortalRequest) {
    const page = await this.hrDocuments.list(
      req.companyId!,
      req.employeeId!,
    );
    return { items: page.items.map(toPortalDocument) };
  }

  @Get('documents/:id/download')
  @RequireModule('hr')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  async downloadDocument(
    @Req() req: EmployeePortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.hrDocuments.getDownload(
      req.companyId!,
      req.employeeId!,
      id,
    );
  }

  /** D221 — own bulletins only (requires `hr` ENABLED). */
  @Get('bulletins')
  @RequireModule('hr')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  async listBulletins(
    @Req() req: EmployeePortalRequest,
    @Query('periodYm') periodYm?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const result = await this.bulletin.list(req.companyId!, {
      employeeId: req.employeeId!,
      periodYm,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return { items: result.items.map(toPortalBulletin) };
  }

  @Get('bulletins/:id')
  @RequireModule('hr')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  async getBulletin(
    @Req() req: EmployeePortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const row = await this.bulletin.getForEmployee(
      req.companyId!,
      req.employeeId!,
      id,
    );
    return toPortalBulletin(row);
  }

  @Get('bulletins/:id/pdf')
  @RequireModule('hr')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  async getBulletinPdf(
    @Req() req: EmployeePortalRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.bulletin.getForEmployee(
      req.companyId!,
      req.employeeId!,
      id,
    );
    const result = await this.bulletinPdf.generateAndPersist(
      req.companyId!,
      req.user!.id,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('X-Authority-Document-Id', result.documentId);
    return new StreamableFile(result.buffer);
  }

  private async moduleHrDocs(
    companyId: string,
    employeeId: string,
  ): Promise<number> {
    try {
      const page = await this.hrDocuments.list(companyId, employeeId);
      return page.items.length;
    } catch {
      return 0;
    }
  }

  private async moduleBulletins(
    companyId: string,
    employeeId: string,
  ): Promise<
    Array<{
      id: string;
      number: string;
      periodYm: string;
      netPay: string;
      currency: string;
    }>
  > {
    try {
      const result = await this.bulletin.list(companyId, {
        employeeId,
        limit: 1,
      });
      return result.items.map(toPortalBulletin);
    } catch {
      return [];
    }
  }

  private setSessionCookie(res: Response, token: string, expires: Date): void {
    res.cookie(EMPLOYEE_PORTAL_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires,
    });
  }
}
