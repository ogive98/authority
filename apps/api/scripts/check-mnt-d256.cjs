const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const tables = await p.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'mnt_%' OR tablename LIKE 'flt_%') ORDER BY tablename",
  );
  console.log('tables', tables);

  const migs = await p.$queryRawUnsafe(
    "SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations WHERE migration_name LIKE '%fleet%' OR migration_name LIKE '%maintenance%' ORDER BY migration_name",
  );
  console.log('migs', migs);

  const states = await p.modModuleState.findMany({
    where: { moduleKey: { in: ['fleet', 'maintenance'] } },
    select: { companyId: true, moduleKey: true, status: true },
  });
  console.log('states', states);

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
