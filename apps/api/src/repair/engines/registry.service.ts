import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ERROR_SIGNATURES,
  ERROR_SIGNATURES_BY_COMPONENT,
  ERROR_SIGNATURES_BY_ID,
  type ErrorSignature,
} from '../catalogs/signatures.catalog';
import {
  REPAIR_SCENARIOS,
  REPAIR_SCENARIOS_BY_ID,
  type RepairScenario,
} from '../catalogs/scenarios.catalog';
import {
  SCAN_LEVELS,
  SCAN_LEVELS_BY_ID,
  type ScanDepthId,
  type ScanLevel,
} from '../catalogs/scan-levels.catalog';
import { REPAIR_ERROR_CODES } from '../repair.constants';
import { RepairException } from '../repair.exception';

@Injectable()
export class RepairRegistryService {
  listSignatures(): readonly ErrorSignature[] {
    return ERROR_SIGNATURES;
  }

  getSignature(id: string): ErrorSignature | undefined {
    return ERROR_SIGNATURES_BY_ID.get(id);
  }

  requireSignature(id: string): ErrorSignature {
    const sig = this.getSignature(id);
    if (!sig) {
      throw new RepairException(
        REPAIR_ERROR_CODES.INVALID_SIGNATURE,
        `Unknown signature: ${id}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return sig;
  }

  matchSignatureByComponent(component: string): ErrorSignature | undefined {
    return ERROR_SIGNATURES_BY_COMPONENT.get(component);
  }

  listScenarios(): readonly RepairScenario[] {
    return REPAIR_SCENARIOS;
  }

  getScenario(id: string): RepairScenario | undefined {
    return REPAIR_SCENARIOS_BY_ID.get(id);
  }

  requireScenario(id: string): RepairScenario {
    const scenario = this.getScenario(id);
    if (!scenario) {
      throw new RepairException(
        REPAIR_ERROR_CODES.INVALID_SCENARIO,
        `Unknown scenario: ${id}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return scenario;
  }

  listScanLevels(): readonly ScanLevel[] {
    return SCAN_LEVELS;
  }

  getScanLevel(id: string): ScanLevel | undefined {
    return SCAN_LEVELS_BY_ID.get(id as ScanDepthId);
  }

  requireScanLevel(id: string): ScanLevel {
    const level = this.getScanLevel(id);
    if (!level) {
      throw new RepairException(
        REPAIR_ERROR_CODES.INVALID_DEPTH,
        `Unknown scan depth: ${id}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return level;
  }
}
