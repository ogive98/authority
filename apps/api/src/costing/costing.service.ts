import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CostingException } from './costing.exception';
import { COSTING_ERROR_CODES } from './costing.constants';

@Injectable()
export class CostingService {
  constructor(private readonly prisma: PrismaService) {}

  async runRollup(companyId: string, period: string) {
    const recipes = await this.prisma.bomRecipe.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      include: { lines: true },
    });

    const results = [];

    for (const recipe of recipes) {
      let totalCost = new Prisma.Decimal(0);

      for (const line of recipe.lines) {
        const avgPrice = await this.getAveragePurchasePrice(
          companyId,
          line.productId,
        );
        const lineCost = avgPrice.mul(line.qty);
        const scrapCost = lineCost.mul(line.scrapPct).div(100);
        totalCost = totalCost.add(lineCost).add(scrapCost);
      }

      const stdCost = totalCost.div(recipe.yield);

      const roll = await this.prisma.cstRoll.upsert({
        where: {
          companyId_productId_period: {
            companyId,
            productId: recipe.productId,
            period,
          },
        },
        update: {
          stdCost,
          postedAt: new Date(),
        },
        create: {
          companyId,
          productId: recipe.productId,
          period,
          stdCost,
          postedAt: new Date(),
        },
      });

      results.push({
        id: roll.id,
        productId: roll.productId,
        period: roll.period,
        stdCost: roll.stdCost.toFixed(3),
        postedAt: roll.postedAt,
      });
    }

    return results;
  }

  async getProductCost(companyId: string, productId: string) {
    const roll = await this.prisma.cstRoll.findFirst({
      where: { companyId, productId },
      orderBy: { postedAt: 'desc' },
    });

    if (!roll) {
      throw new CostingException(
        COSTING_ERROR_CODES.NOT_FOUND,
        'No cost rollup found for this product.',
      );
    }

    return {
      id: roll.id,
      productId: roll.productId,
      period: roll.period,
      stdCost: roll.stdCost.toFixed(3),
      postedAt: roll.postedAt,
    };
  }

  async listRolls(companyId: string) {
    const rolls = await this.prisma.cstRoll.findMany({
      where: { companyId },
      orderBy: { postedAt: 'desc' },
      take: 100,
    });

    return rolls.map((r) => ({
      id: r.id,
      productId: r.productId,
      period: r.period,
      stdCost: r.stdCost.toFixed(3),
      postedAt: r.postedAt,
    }));
  }

  private async getAveragePurchasePrice(
    companyId: string,
    productId: string,
  ): Promise<Prisma.Decimal> {
    const result = await this.prisma.procPoLine.aggregate({
      where: {
        companyId,
        productId,
        po: {
          status: 'CONFIRMED',
        },
      },
      _avg: {
        unitPrice: true,
      },
    });

    return result._avg?.unitPrice ?? new Prisma.Decimal(0);
  }
}
