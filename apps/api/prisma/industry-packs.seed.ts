import type { MdRefKind, Prisma, PrismaClient } from '@prisma/client';

type PackItem = {
  kind: MdRefKind;
  code: string;
  label: string;
  sort: number;
  meta?: Prisma.InputJsonValue;
};

type PackDef = {
  key: string;
  name: string;
  description: string;
  items: PackItem[];
};

function items(
  kind: MdRefKind,
  rows: Array<[string, string] | [string, string, Prisma.InputJsonValue]>,
): PackItem[] {
  return rows.map((row, i) => ({
    kind,
    code: row[0],
    label: row[1],
    sort: (i + 1) * 10,
    meta: row[2] ?? {},
  }));
}

export const INDUSTRY_PACK_DEFS: PackDef[] = [
  {
    key: 'dairy',
    name: 'Fromagerie / agroalimentaire',
    description: 'Pack DEMO — MP, PF, froid/sec, allergènes alimentaires',
    items: [
      ...items('product_type', [
        ['RAW_MATERIAL', 'Matière première'],
        ['SUPPLY', 'Fourniture'],
        ['PACKAGING', 'Emballage'],
        ['CONSUMABLE', 'Consommable'],
        ['FINISHED', 'Produit fini'],
        ['IMPORTED', 'Importé'],
      ]),
      ...items('uom', [
        ['kg', 'Kilogramme'],
        ['L', 'Litre'],
        ['pcs', 'Pièce'],
        ['box', 'Carton'],
      ]),
      ...items('storage_class', [
        ['COLD', 'Froid'],
        ['DRY', 'Sec'],
        ['AMBIENT', 'Ambiant'],
      ]),
      ...items('allergen', [
        ['milk', 'Lait'],
        ['gluten', 'Gluten'],
        ['nuts', 'Fruits à coque'],
        ['eggs', 'Œufs'],
      ]),
    ],
  },
  {
    key: 'grocery',
    name: 'Épicerie',
    description: 'Frais, sec, boissons, ménager',
    items: [
      ...items('product_type', [
        ['FRESH', 'Frais'],
        ['DRY_GOODS', 'Épicerie sèche'],
        ['BEVERAGE', 'Boisson'],
        ['FROZEN', 'Surgelé'],
        ['HOUSEHOLD', 'Ménager'],
      ]),
      ...items('uom', [
        ['kg', 'Kilogramme'],
        ['g', 'Gramme'],
        ['L', 'Litre'],
        ['pcs', 'Pièce'],
        ['pack', 'Pack'],
      ]),
      ...items('storage_class', [
        ['COLD', 'Froid'],
        ['FROZEN', 'Surgelé'],
        ['DRY', 'Sec'],
        ['AMBIENT', 'Ambiant'],
      ]),
      ...items('allergen', [
        ['gluten', 'Gluten'],
        ['milk', 'Lait'],
        ['nuts', 'Fruits à coque'],
        ['soy', 'Soja'],
      ]),
    ],
  },
  {
    key: 'optic',
    name: 'Optique',
    description: 'Montures, verres, lentilles',
    items: [
      ...items('product_type', [
        ['FRAME', 'Monture'],
        ['LENS', 'Verre'],
        ['CONTACT', 'Lentille'],
        ['ACCESSORY', 'Accessoire'],
        ['SERVICE', 'Prestation'],
      ]),
      ...items('uom', [
        ['pcs', 'Pièce'],
        ['pair', 'Paire'],
      ]),
      ...items('storage_class', [
        ['AMBIENT', 'Ambiant'],
        ['DRY', 'Sec'],
      ]),
      ...items('allergen', [['nickel', 'Nickel']]),
    ],
  },
  {
    key: 'dental',
    name: 'Dentaire',
    description: 'Matériaux, instruments, prothèses',
    items: [
      ...items('product_type', [
        ['MATERIAL', 'Matériau'],
        ['INSTRUMENT', 'Instrument'],
        ['PROSTHETIC', 'Prothèse'],
        ['CONSUMABLE', 'Consommable'],
        ['SERVICE', 'Prestation'],
      ]),
      ...items('uom', [
        ['pcs', 'Pièce'],
        ['kit', 'Kit'],
        ['ml', 'Millilitre'],
      ]),
      ...items('storage_class', [
        ['AMBIENT', 'Ambiant'],
        ['COLD', 'Froid'],
      ]),
      ...items('allergen', [
        ['latex', 'Latex'],
        ['metal', 'Métal'],
      ]),
    ],
  },
  {
    key: 'factory',
    name: 'Usine / industriel',
    description: 'MP, WIP, PF, pièces détachées',
    items: [
      ...items('product_type', [
        ['RAW_MATERIAL', 'Matière première'],
        ['WIP', 'En-cours'],
        ['FINISHED', 'Produit fini'],
        ['SPARE_PART', 'Pièce détachée'],
        ['CONSUMABLE', 'Consommable'],
      ]),
      ...items('uom', [
        ['kg', 'Kilogramme'],
        ['m', 'Mètre'],
        ['pcs', 'Pièce'],
        ['lot', 'Lot'],
      ]),
      ...items('storage_class', [
        ['DRY', 'Sec'],
        ['AMBIENT', 'Ambiant'],
        ['QUARANTINE', 'Quarantaine'],
      ]),
      ...items('allergen', []),
    ],
  },
  {
    key: 'generic',
    name: 'Générique',
    description: 'Bien / service minimal',
    items: [
      ...items('product_type', [
        ['GOOD', 'Bien'],
        ['SERVICE', 'Service'],
      ]),
      ...items('uom', [
        ['pcs', 'Pièce'],
        ['unit', 'Unité'],
      ]),
      ...items('storage_class', [['AMBIENT', 'Ambiant']]),
      ...items('allergen', []),
    ],
  },
];

export async function seedIndustryPacks(prisma: PrismaClient): Promise<void> {
  for (const def of INDUSTRY_PACK_DEFS) {
    const pack = await prisma.saIndustryPack.upsert({
      where: { key: def.key },
      update: {
        name: def.name,
        description: def.description,
      },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
      },
    });

    for (const item of def.items) {
      await prisma.saIndustryPackItem.upsert({
        where: {
          packId_kind_code: {
            packId: pack.id,
            kind: item.kind,
            code: item.code,
          },
        },
        update: {
          label: item.label,
          sort: item.sort,
          metaJson: item.meta ?? {},
        },
        create: {
          packId: pack.id,
          kind: item.kind,
          code: item.code,
          label: item.label,
          sort: item.sort,
          metaJson: item.meta ?? {},
        },
      });
    }
  }
}

export async function applyPackToCompany(
  prisma: PrismaClient,
  companyId: string,
  packKey: string,
): Promise<void> {
  const pack = await prisma.saIndustryPack.findUnique({
    where: { key: packKey },
    include: { items: true },
  });
  if (!pack) return;

  for (const item of pack.items) {
    await prisma.mdRefValue.upsert({
      where: {
        companyId_kind_code: {
          companyId,
          kind: item.kind,
          code: item.code,
        },
      },
      update: {
        label: item.label,
        sort: item.sort,
        metaJson: (item.metaJson ?? {}) as Prisma.InputJsonValue,
        enabled: true,
        deletedAt: null,
      },
      create: {
        companyId,
        kind: item.kind,
        code: item.code,
        label: item.label,
        sort: item.sort,
        metaJson: (item.metaJson ?? {}) as Prisma.InputJsonValue,
        enabled: true,
      },
    });
  }
}
