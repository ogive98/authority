-- D302 Settings SITE scope (between COMPANY and ROLE in app priority)
ALTER TYPE "SetLevel" ADD VALUE IF NOT EXISTS 'SITE' AFTER 'COMPANY';
