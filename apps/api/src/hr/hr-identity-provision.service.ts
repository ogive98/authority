import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  IamGrantSubject,
  IamUserStatus,
  type Prisma,
} from '@prisma/client';
import { InviteSettingsResolver } from '../identity/invite-settings.resolver';
import { PasswordService } from '../identity/password.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { HR_ERROR_CODES } from './hr.constants';
import { HrException } from './hr.exception';

export type HrProvisionResult = {
  userId: string;
  email: string;
  provisionalPassword: string;
  emailSent: boolean;
  smtpConfigured: boolean;
};

/**
 * D219 — provision Identity ACTIVE + role `employee` for a new HrEmployee.
 * Provisional password returned once; Soft Glass welcome mail is best-effort.
 */
@Injectable()
export class HrIdentityProvisionService {
  private readonly logger = new Logger(HrIdentityProvisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly inviteSettings: InviteSettingsResolver,
    private readonly mail: MailService,
  ) {}

  async provisionForNewEmployee(params: {
    companyId: string;
    employeeId: string;
    email: string;
    displayName: string;
    tx: Prisma.TransactionClient;
  }): Promise<HrProvisionResult> {
    const email = params.email.trim().toLowerCase();
    if (!email) {
      throw new HrException(
        HR_ERROR_CODES.EMAIL_REQUIRED,
        'Email is required to provision Identity login.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await params.tx.iamUser.findUnique({ where: { email } });
    if (existing && !existing.deletedAt) {
      throw new HrException(
        HR_ERROR_CODES.EMAIL_EXISTS,
        'An Identity user with this email already exists. Link it from the fiche instead.',
        HttpStatus.CONFLICT,
      );
    }

    const cfg = await this.inviteSettings.resolve(params.companyId);
    const provisionalPassword = this.generateProvisionalPassword(
      cfg.minPasswordLength,
    );
    const passwordHash = await this.passwords.hash(provisionalPassword);

    const user = await params.tx.iamUser.create({
      data: {
        email,
        displayName: params.displayName.trim(),
        status: IamUserStatus.ACTIVE,
        passwordHash,
      },
    });

    await params.tx.orgUserAssignment.create({
      data: {
        companyId: params.companyId,
        userId: user.id,
        roleCode: 'employee',
      },
    });

    await params.tx.iamGrant.create({
      data: {
        permissionKey: 'identity.self.read',
        effect: 'ALLOW',
        subjectType: IamGrantSubject.USER,
        subjectId: user.id,
      },
    });
    await params.tx.iamGrant.create({
      data: {
        permissionKey: 'identity.session.revoke',
        effect: 'ALLOW',
        subjectType: IamGrantSubject.USER,
        subjectId: user.id,
      },
    });

    await params.tx.hrEmployee.update({
      where: { id: params.employeeId },
      data: { userId: user.id },
    });

    const mailResult = await this.trySendWelcomeEmail({
      companyId: params.companyId,
      email,
      displayName: params.displayName.trim(),
      provisionalPassword,
      portalUrl: `${cfg.webOrigin}/employee-portal/login`,
      smtp: cfg.smtp,
      autoSend: cfg.autoSend,
    });

    return {
      userId: user.id,
      email,
      provisionalPassword,
      emailSent: mailResult.emailSent,
      smtpConfigured: mailResult.smtpConfigured,
    };
  }

  private generateProvisionalPassword(minLength: number): string {
    const len = Math.max(minLength, 12);
    // base64url ~ 4/3 expansion; request enough bytes then trim.
    const raw = randomBytes(Math.ceil((len * 3) / 4) + 2).toString('base64url');
    return raw.slice(0, len);
  }

  private async trySendWelcomeEmail(params: {
    companyId: string;
    email: string;
    displayName: string;
    provisionalPassword: string;
    portalUrl: string;
    smtp: Parameters<MailService['isConfigured']>[0];
    autoSend: boolean;
  }): Promise<{ emailSent: boolean; smtpConfigured: boolean }> {
    const smtpConfigured = this.mail.isConfigured(params.smtp);
    if (!smtpConfigured || !params.autoSend) {
      return { emailSent: false, smtpConfigured };
    }
    try {
      const subject = 'AUTHORITY — Accès Employee Portal (provisoire)';
      const text = [
        `Bonjour ${params.displayName},`,
        '',
        'Un compte Identity a été créé pour vous sur AUTHORITY.',
        `E-mail : ${params.email}`,
        `Mot de passe provisoire : ${params.provisionalPassword}`,
        `Connexion Employee Portal : ${params.portalUrl}`,
        '',
        'Changez ce mot de passe après votre première connexion.',
        'Powered by AUTHORITY',
      ].join('\n');
      const html = `<p>Bonjour ${escapeHtml(params.displayName)},</p>
<p>Un compte Identity a été créé pour vous sur <strong>AUTHORITY</strong>.</p>
<ul>
<li>E-mail : <code>${escapeHtml(params.email)}</code></li>
<li>Mot de passe provisoire : <code>${escapeHtml(params.provisionalPassword)}</code></li>
</ul>
<p><a href="${escapeHtml(params.portalUrl)}">Ouvrir Employee Portal</a></p>
<p>Changez ce mot de passe après votre première connexion.</p>
<p style="color:#64748b;font-size:12px">Powered by AUTHORITY</p>`;
      await this.mail.send(
        { to: params.email, subject, text, html },
        params.smtp,
      );
      return { emailSent: true, smtpConfigured: true };
    } catch (e) {
      this.logger.warn(
        `Welcome email failed for ${params.email}: ${
          e instanceof Error ? e.message : 'unknown'
        } (company=${params.companyId} hash=${createHash('sha256')
          .update(params.email)
          .digest('hex')
          .slice(0, 8)})`,
      );
      return { emailSent: false, smtpConfigured: true };
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
