import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canOrder?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveInvoices?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveDeliveryNotes?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveDunning?: boolean;

  @IsOptional()
  @IsBoolean()
  portalAccess?: boolean;
}

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  /** Creates md_party when partyId omitted. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  salesRep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentTerms?: string;

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  @IsOptional()
  @IsBoolean()
  salubritaEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  salubritaWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  salubritaPortal?: boolean;

  @IsOptional()
  @IsIn(['DELIVERY_NOTE', 'INVOICE'])
  fulfillmentDoc?: 'DELIVERY_NOTE' | 'INVOICE';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContactDto)
  contacts?: CreateContactDto[];
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nickname?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  salesRep?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentTerms?: string | null;

  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  @IsOptional()
  @IsBoolean()
  salubritaEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  salubritaWhatsapp?: boolean;

  @IsOptional()
  @IsBoolean()
  salubritaPortal?: boolean;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'PROSPECT', 'ON_HOLD', 'ARCHIVED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'ON_HOLD' | 'ARCHIVED';

  @IsOptional()
  @IsBoolean()
  enableCreditControl?: boolean;

  @IsOptional()
  @IsBoolean()
  alertBeforeCreditLimit?: boolean;

  @IsOptional()
  @IsBoolean()
  blockOnCreditLimit?: boolean;

  @IsOptional()
  @IsBoolean()
  allowExceptionalOverride?: boolean;

  @IsOptional()
  @IsBoolean()
  blockOnCriticalOverdue?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyResponsible?: boolean;

  @IsOptional()
  @IsIn(['DELIVERY_NOTE', 'INVOICE'])
  fulfillmentDoc?: 'DELIVERY_NOTE' | 'INVOICE';

  @IsInt()
  @Min(0)
  version!: number;
}

export class SetCreditDto {
  @IsNumberString()
  creditLimit!: string;

  @IsInt()
  @Min(0)
  version!: number;
}

export class BlockCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;

  @IsInt()
  @Min(0)
  version!: number;
}

export class UnblockCustomerDto {
  @IsInt()
  @Min(0)
  version!: number;
}

export class CreateZoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canOrder?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveInvoices?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveDeliveryNotes?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveDunning?: boolean;

  @IsOptional()
  @IsBoolean()
  portalAccess?: boolean;

  @IsInt()
  @Min(0)
  version!: number;
}

export class CreateAddressDto {
  @IsIn(['HQ', 'BILLING', 'SHIPPING', 'WAREHOUSE', 'STORE', 'POS'])
  type!: 'HQ' | 'BILLING' | 'SHIPPING' | 'WAREHOUSE' | 'STORE' | 'POS';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  governorate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsIn(['HQ', 'BILLING', 'SHIPPING', 'WAREHOUSE', 'STORE', 'POS'])
  type?: 'HQ' | 'BILLING' | 'SHIPPING' | 'WAREHOUSE' | 'STORE' | 'POS';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  line2?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  governorate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  postalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsInt()
  @Min(0)
  version!: number;
}

/** D174 — negotiated HT unit price (TND). */
export class UpsertCustomerPriceDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceHt!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

/** D242 — ADV portal membership link. */
export class CreatePortalMembershipDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsIn(['buyer', 'viewer', 'admin'])
  role?: 'buyer' | 'viewer' | 'admin';
}

export class UpdatePortalMembershipDto {
  @IsOptional()
  @IsIn(['buyer', 'viewer', 'admin'])
  role?: 'buyer' | 'viewer' | 'admin';

  @IsOptional()
  @IsIn(['ACTIVE', 'REVOKED'])
  status?: 'ACTIVE' | 'REVOKED';

  @IsInt()
  @Min(0)
  version!: number;
}

/** D260 — customer fiscal profile (classification only; rates stay in Tax Engine / Prefs). */
export class UpsertCustomerFiscalProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  fiscalRegime?: string | null;

  @IsOptional()
  @IsBoolean()
  vatLiable?: boolean | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  fiscalStatus?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  fiscalCategory?: string | null;

  @IsOptional()
  @IsBoolean()
  withholdingArEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class UpsertCustomerFiscalOverrideDto {
  @IsUUID()
  taxCodeId!: string;

  @IsIn(['AUTO', 'ALWAYS', 'NEVER', 'CONFIRM'])
  mode!: 'AUTO' | 'ALWAYS' | 'NEVER' | 'CONFIRM';

  @IsOptional()
  @IsIn([
    'SYSTEM_RULE',
    'CLIENT_OVERRIDE',
    'EXEMPTION',
    'MANUAL_OVERRIDE',
  ])
  source?:
    | 'SYSTEM_RULE'
    | 'CLIENT_OVERRIDE'
    | 'EXEMPTION'
    | 'MANUAL_OVERRIDE';

  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justification?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string | null;

  @IsOptional()
  @IsUUID()
  documentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}
