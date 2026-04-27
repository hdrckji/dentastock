import { ReorderMode } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type ReorderSuggestion = {
  productId: string;
  ean: string;
  description: string;
  brand: string;
  minimumStock: number;
  currentStock: number;
  suggestedQuantity: number;
  mode: ReorderMode;
  supplierLeadTimeDays: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function averageDailyConsumption(totalOut: number, days: number): number {
  if (days <= 0) {
    return 0;
  }
  return totalOut / days;
}

export async function getInventoryConfig() {
  return prisma.inventoryConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export async function computeReorderSuggestions(modeOverride?: ReorderMode): Promise<ReorderSuggestion[]> {
  const config = await getInventoryConfig();
  const mode = modeOverride ?? config.reorderMode;

  const sinceDate = new Date(Date.now() - config.advancedForecastHorizon * ONE_DAY_MS);

  const products = await prisma.product.findMany({
    include: {
      lots: true,
      suppliers: {
        include: {
          supplier: true,
        },
      },
      movements: {
        where: {
          type: "OUT",
          occurredAt: {
            gte: sinceDate,
          },
        },
      },
    },
    orderBy: {
      description: "asc",
    },
  });

  return products
    .map((product) => {
      const currentStock = product.lots.reduce((sum, lot) => sum + lot.quantityOnHand, 0);
      const primarySupplier =
        product.suppliers.find((item) => item.isPrimary)?.supplier ??
        product.suppliers[0]?.supplier ??
        null;
      const supplierLeadTimeDays = primarySupplier?.leadTimeDays ?? 7;

      if (mode === ReorderMode.SIMPLE) {
        const missing = product.minimumStock - currentStock;
        const suggestedQuantity = missing > 0 ? missing : 0;

        return {
          productId: product.id,
          ean: product.ean,
          description: product.description,
          brand: product.brand,
          minimumStock: product.minimumStock,
          currentStock,
          suggestedQuantity,
          mode,
          supplierLeadTimeDays,
        };
      }

      const totalOut = product.movements.reduce((sum, movement) => sum + movement.quantity, 0);
      const dailyOut = averageDailyConsumption(totalOut, config.advancedForecastHorizon);
      const targetStock = Math.ceil(dailyOut * (supplierLeadTimeDays + config.safetyDays));
      const advancedMinimum = Math.max(product.minimumStock, targetStock);
      const missing = advancedMinimum - currentStock;

      return {
        productId: product.id,
        ean: product.ean,
        description: product.description,
        brand: product.brand,
        minimumStock: advancedMinimum,
        currentStock,
        suggestedQuantity: missing > 0 ? missing : 0,
        mode,
        supplierLeadTimeDays,
      };
    })
    .filter((item) => item.suggestedQuantity > 0);
}
