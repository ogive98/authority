import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { IamSessionRealm } from '@prisma/client';
import type { Request, Response } from 'express';
import { AttendanceService } from '../attendance/attendance.service';
import { BulletinPdfService } from '../hr/bulletin-pdf.service';
import { BulletinService } from '../hr/bulletin.service';
import { LoginDto } from '../identity/login.dto';
import { SessionService } from '../identity/session.service';
import { RequireModule } from '../modules-registry/modules.decorators';
import { toPortalBulletin } from './employee-portal-bulletin.mapper';
import { EMPLOYEE_PORTAL_COOKIE_NAME } from './employee-portal.constants';
import { PortalCreateAbsenceDto } from './employee-portal.dto';
import { EmployeePortalAuthService } from './employee-portal-auth.service';
import { EmployeePortalModuleGuard } from './employee-portal-module.guard';
import {
  EmployeePortalSessionGuard,
  type EmployeePortalRequest,
} from './employee-portal-session.guard';

@Controller('api/v1/employee-portal')
export class EmployeePortalController {
  constructor(
    private readonly portalAuthService: EmployeePortalAuthService,
    private readonly attendance: AttendanceService,
    private readonly bulletin: BulletinService,
    private readonly bulletinPdf: BulletinPdfService,
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

  @Get('absences')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  listAbsences(@Req() req: EmployeePortalRequest) {
    return this.attendance.listAbsences(req.companyId!, {
      employeeId: req.employeeId!,
    });
  }

  @Get('calendar')
  @UseGuards(EmployeePortalSessionGuard, EmployeePortalModuleGuard)
  calendar(@Req() req: EmployeePortalRequest) {
    return this.attendance.getCalendar(req.companyId!, {
      employeeId: req.employeeId!,
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
