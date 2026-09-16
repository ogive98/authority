-- D277 FORGE Phase 1 foundation — extension / feature request / metadata contracts.

CREATE TYPE "FrgExtensionStatus" AS ENUM (
  'DRAFT',
  'ANALYZING',
  'GENERATING',
  'VALIDATING',
  'TESTING',
  'READY_FOR_REVIEW',
  'APPROVED',
  'ACTIVE',
  'SUSPENDED',
  'DISABLED',
  'FAILED',
  'ARCHIVED'
);

CREATE TYPE "FrgFeatureRequestStatus" AS ENUM (
  'RECEIVED',
  'ANALYZING',
  'PLANNED',
  'WAITING_APPROVAL',
  'IMPLEMENTING',
  'TESTING',
  'READY',
  'DEPLOYED',
  'REJECTED',
  'FAILED'
);

CREATE TYPE "FrgMetadataType" AS ENUM (
  'entity',
  'field',
  'action',
  'view',
  'form',
  'table',
  'workflow',
  'report',
  'automation'
);

CREATE TYPE "FrgMetadataStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'ARCHIVED'
);

CREATE TABLE "frg_extension" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "manifest_version" TEXT NOT NULL,
  "status" "FrgExtensionStatus" NOT NULL DEFAULT 'DRAFT',
  "tenant_scope" TEXT NOT NULL DEFAULT 'company',
  "manifest_json" JSONB NOT NULL DEFAULT '{}',
  "dependencies_json" JSONB NOT NULL DEFAULT '[]',
  "compatible_core_version" TEXT,
  "created_by_user_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "frg_extension_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "frg_extension_company_id_key_key" ON "frg_extension"("company_id", "key");
CREATE INDEX "frg_extension_company_id_status_idx" ON "frg_extension"("company_id", "status");
CREATE INDEX "frg_extension_company_id_created_at_idx" ON "frg_extension"("company_id", "created_at" DESC);

CREATE TABLE "frg_feature_request" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "FrgFeatureRequestStatus" NOT NULL DEFAULT 'RECEIVED',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "requested_by_user_id" UUID,
  "affected_modules_json" JSONB NOT NULL DEFAULT '[]',
  "extension_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "frg_feature_request_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "frg_feature_request_company_id_status_idx" ON "frg_feature_request"("company_id", "status");
CREATE INDEX "frg_feature_request_company_id_created_at_idx" ON "frg_feature_request"("company_id", "created_at" DESC);
CREATE INDEX "frg_feature_request_company_id_extension_id_idx" ON "frg_feature_request"("company_id", "extension_id");

ALTER TABLE "frg_feature_request" ADD CONSTRAINT "frg_feature_request_extension_id_fkey"
  FOREIGN KEY ("extension_id") REFERENCES "frg_extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "frg_metadata_definition" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "type" "FrgMetadataType" NOT NULL,
  "module_key" TEXT NOT NULL,
  "extension_id" UUID,
  "schema_json" JSONB NOT NULL DEFAULT '{}',
  "status" "FrgMetadataStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "frg_metadata_definition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "frg_metadata_definition_company_id_key_key" ON "frg_metadata_definition"("company_id", "key");
CREATE INDEX "frg_metadata_definition_company_id_type_idx" ON "frg_metadata_definition"("company_id", "type");
CREATE INDEX "frg_metadata_definition_company_id_module_key_idx" ON "frg_metadata_definition"("company_id", "module_key");
CREATE INDEX "frg_metadata_definition_company_id_extension_id_idx" ON "frg_metadata_definition"("company_id", "extension_id");

ALTER TABLE "frg_metadata_definition" ADD CONSTRAINT "frg_metadata_definition_extension_id_fkey"
  FOREIGN KEY ("extension_id") REFERENCES "frg_extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;
