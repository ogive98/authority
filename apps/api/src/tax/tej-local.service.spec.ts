import { createHash } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import { TAX_ERROR_CODES, TAX_EVENT_TYPES } from './tax.constants';
import { TaxException } from './tax.exception';
import { TEJ_LOCAL_SCHEMA_NOTE, TejLocalService } from './tej-local.service';

describe('TejLocalService (D265)', () => {
  const companyId = 'c1';

  function build(opts?: {
    tej?: { valueLabel: string; lawRef: string | null } | null;
  }) {
    const tej =
      opts && 'tej' in opts
        ? opts.tej
        : {
            valueLabel: 'params locaux expert',
            lawRef: 'LF art.X',
          };
    const prisma = {
      taxTejExport: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          taxTejExport: {
            create: jest.fn().mockImplementation(async ({ data }) => ({
              id: 'tej-1',
              companyId,
              ...data,
              createdAt: new Date('2026-09-15T12:00:00.000Z'),
              updatedAt: new Date('2026-09-15T12:00:00.000Z'),
            })),
          },
        };
        return fn(tx);
      }),
    };
    const expertise = {
      getTej: jest.fn().mockResolvedValue(
        tej
          ? {
              key: 'tax.tej',
              valueLabel: tej.valueLabel,
              lawRef: tej.lawRef,
            }
          : null,
      ),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const service = new TejLocalService(
      prisma as never,
      expertise as never,
      outbox as never,
    );
    return { service, prisma, expertise, outbox };
  }

  it('rejects generate when tax.tej Prefs not VALIDATED', async () => {
    const { service } = build({ tej: null });
    await expect(
      service.generate(companyId, { periodLabel: '2026-Q3' }),
    ).rejects.toMatchObject({
      code: TAX_ERROR_CODES.INVALID_STATUS,
      status: HttpStatus.CONFLICT,
    } satisfies Partial<TaxException>);
  });

  it('rejects empty periodLabel', async () => {
    const { service } = build();
    await expect(
      service.generate(companyId, { periodLabel: '  ' }),
    ).rejects.toMatchObject({
      code: TAX_ERROR_CODES.INVALID_INPUT,
    });
  });

  it('generates local XML + SHA-256 and enqueues event (transmission DISABLED)', async () => {
    const { service, outbox } = build();
    const result = await service.generate(companyId, {
      periodLabel: '2026-Q3',
      createdByUserId: 'u1',
    });

    expect(result.transmission).toBe('DISABLED');
    expect(result.schemaNote).toBe(TEJ_LOCAL_SCHEMA_NOTE);
    expect(result.periodLabel).toBe('2026-Q3');
    expect(result.xmlContent).toContain('AuthorityTejLocalDraft');
    expect(result.xmlContent).toContain('transmission="DISABLED"');
    expect(result.xmlContent).toContain('Do not upload or transmit');
    expect(result.xmlContent).toContain('AUTHORITY_LOCAL_DRAFT');
    expect(result.xmlContent).toContain('not an official TEJ XSD');
    expect(result.contentSha256).toBe(
      createHash('sha256').update(result.xmlContent!, 'utf8').digest('hex'),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: TAX_EVENT_TYPES.TEJ_LOCAL_GENERATED,
        payloadJson: expect.objectContaining({
          transmission: 'DISABLED',
          contentSha256: result.contentSha256,
        }),
      }),
    );
  });

  it('list returns transmission DISABLED without xml bodies', async () => {
    const { service, prisma } = build();
    prisma.taxTejExport.findMany.mockResolvedValue([
      {
        id: 'tej-1',
        companyId,
        periodLabel: '2026-Q3',
        contentSha256: 'abc',
        xmlContent: '<xml/>',
        prefsValueLabel: 'x',
        lawRef: null,
        schemaNote: TEJ_LOCAL_SCHEMA_NOTE,
        createdAt: new Date('2026-09-15T12:00:00.000Z'),
      },
    ]);
    const res = await service.list(companyId);
    expect(res.transmission).toBe('DISABLED');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].xmlContent).toBeUndefined();
    expect(res.items[0].contentSha256).toBe('abc');
  });
});
