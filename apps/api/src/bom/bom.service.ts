import { Injectable } from '@nestjs/common';
import { BomRecipeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BomException } from './bom.exception';
import { BOM_ERROR_CODES } from './bom.constants';

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecipes(companyId: string) {
    return this.prisma.bomRecipe.findMany({
      where: { companyId, deletedAt: null },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRecipe(companyId: string, id: string) {
    const recipe = await this.prisma.bomRecipe.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: true },
    });
    if (!recipe) {
      throw new BomException(
        BOM_ERROR_CODES.NOT_FOUND,
        'Recipe not found.',
      );
    }
    return recipe;
  }

  async createRecipe(
    companyId: string,
    dto: {
      productId: string;
      version: number;
      yield?: string;
      notes?: string;
    },
  ) {
    const number = await this.nextNumber(companyId);
    return this.prisma.bomRecipe.create({
      data: {
        companyId,
        number,
        productId: dto.productId,
        version: dto.version,
        yield: dto.yield ? parseFloat(dto.yield) : 1,
        notes: dto.notes,
        status: BomRecipeStatus.DRAFT,
      },
      include: { lines: true },
    });
  }

  async addLines(
    companyId: string,
    recipeId: string,
    lines: {
      productId: string;
      qty: string;
      uom: string;
      scrapPct?: string;
      step?: number;
    }[],
  ) {
    const recipe = await this.getRecipe(companyId, recipeId);
    if (recipe.status !== BomRecipeStatus.DRAFT) {
      throw new BomException(
        BOM_ERROR_CODES.INVALID_VERSION,
        'Can only add lines to DRAFT recipes.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of lines) {
        await tx.bomLine.create({
          data: {
            companyId,
            recipeId,
            productId: line.productId,
            qty: parseFloat(line.qty),
            uom: line.uom,
            scrapPct: line.scrapPct ? parseFloat(line.scrapPct) : 0,
            step: line.step ?? 0,
          },
        });
      }
      return this.getRecipe(companyId, recipeId);
    });
  }

  async activateRecipe(companyId: string, id: string) {
    const recipe = await this.getRecipe(companyId, id);
    if (recipe.status === BomRecipeStatus.ACTIVE) {
      throw new BomException(
        BOM_ERROR_CODES.ALREADY_ACTIVE,
        'Recipe is already active.',
      );
    }

    const activeCount = await this.prisma.bomRecipe.count({
      where: {
        companyId,
        productId: recipe.productId,
        status: BomRecipeStatus.ACTIVE,
      },
    });

    if (activeCount > 0) {
      throw new BomException(
        BOM_ERROR_CODES.ALREADY_ACTIVE,
        'Another recipe is already active for this product.',
      );
    }

    return this.prisma.bomRecipe.update({
      where: { id },
      data: { status: BomRecipeStatus.ACTIVE },
      include: { lines: true },
    });
  }

  private async nextNumber(companyId: string): Promise<string> {
    const count = await this.prisma.bomRecipe.count({
      where: { companyId },
    });
    const year = new Date().getFullYear();
    return `BOM-${year}-${(count + 1).toString().padStart(4, '0')}`;
  }
}
