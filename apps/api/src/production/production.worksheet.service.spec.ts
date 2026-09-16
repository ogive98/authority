import { PRODUCTION_EVENT_TYPES } from './production.constants';
import { ProductionWorksheetService } from './production.worksheet.service';

const Status = {
  DRAFT: 'DRAFT',
  PREPARED: 'PREPARED',
  WEIGHED: 'WEIGHED',
  CONTROLLED: 'CONTROLLED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

const ControlResult = {
  PASS: 'PASS',
  FAIL: 'FAIL',
} as const;

describe('ProductionWorksheetService (D292)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const productId = '22222222-2222-2222-2222-222222222222';
  const lineId = '33333333-3333-3333-3333-333333333333';
  const wsId = '44444444-4444-4444-4444-444444444444';

  function build() {
    const line = {
      id: lineId,
      companyId,
      worksheetId: wsId,
      lineNo: 1,
      productId,
      requestedQty: { toString: () => '10' },
      preparedQty: null,
      weighedQty: null,
      unit: 'KG',
      lot: null,
      notes: null,
    };
    const draft = {
      id: wsId,
      companyId,
      number: 'WS-2026-0001',
      status: Status.DRAFT,
      orderId: null,
      workOrderId: null,
      siteId: null,
      notes: null,
      controlResult: null,
      controlNote: null,
      preparedAt: null,
      weighedAt: null,
      controlledAt: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      lines: [line],
    };
    const prisma = {
      prdProduct: {
        findFirst: jest.fn().mockResolvedValue({ id: productId }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: productId, sku: 'BRIE', name: 'Brie' }]),
      },
      prodWorkOrder: { findFirst: jest.fn() },
      prodWorksheet: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue(draft),
        findMany: jest.fn().mockResolvedValue([draft]),
        create: jest.fn(),
        update: jest.fn(),
      },
      prodWorksheetLine: {
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const prepared = {
          ...draft,
          status: Status.PREPARED,
          preparedAt: new Date(),
          version: 1,
          lines: [{ ...line, preparedQty: { toString: () => '10' } }],
        };
        const tx = {
          prodWorksheet: {
            create: jest.fn().mockResolvedValue(draft),
            update: jest.fn().mockImplementation(async ({ data }) => {
              if (data.status === Status.PREPARED) return prepared;
              if (data.status === Status.WEIGHED) {
                return {
                  ...prepared,
                  status: Status.WEIGHED,
                  weighedAt: new Date(),
                  lines: [
                    {
                      ...line,
                      preparedQty: { toString: () => '10' },
                      weighedQty: { toString: () => '9.8' },
                    },
                  ],
                };
              }
              if (data.status === Status.CONTROLLED) {
                return {
                  ...prepared,
                  status: Status.CONTROLLED,
                  controlResult: ControlResult.PASS,
                  controlledAt: new Date(),
                  lines: [
                    {
                      ...line,
                      preparedQty: { toString: () => '10' },
                      weighedQty: { toString: () => '9.8' },
                    },
                  ],
                };
              }
              return { ...draft, ...data, lines: draft.lines };
            }),
          },
          prodWorksheetLine: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      }),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }) };
    const service = new ProductionWorksheetService(
      prisma as never,
      outbox as never,
    );
    return { service, prisma, outbox };
  }

  it('creates DRAFT worksheet and emits created event', async () => {
    const { service, outbox } = build();
    const dto = await service.create(companyId, {
      lines: [{ productId, requestedQty: 10, unit: 'KG' }],
    });
    expect(dto.number).toBe('WS-2026-0001');
    expect(dto.status).toBe(Status.DRAFT);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: PRODUCTION_EVENT_TYPES.WORKSHEET_CREATED,
      }),
    );
  });

  it('prepare → weigh → control PASS', async () => {
    const { service, prisma, outbox } = build();
    prisma.prodWorksheet.findFirst
      .mockReset()
      .mockResolvedValueOnce({
        id: wsId,
        companyId,
        number: 'WS-2026-0001',
        status: Status.DRAFT,
        orderId: null,
        workOrderId: null,
        siteId: null,
        notes: null,
        controlResult: null,
        controlNote: null,
        preparedAt: null,
        weighedAt: null,
        controlledAt: null,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        lines: [
          {
            id: lineId,
            companyId,
            worksheetId: wsId,
            lineNo: 1,
            productId,
            requestedQty: { toString: () => '10' },
            preparedQty: null,
            weighedQty: null,
            unit: 'KG',
            lot: null,
            notes: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: wsId,
        companyId,
        number: 'WS-2026-0001',
        status: Status.PREPARED,
        orderId: null,
        workOrderId: null,
        siteId: null,
        notes: null,
        controlResult: null,
        controlNote: null,
        preparedAt: new Date(),
        weighedAt: null,
        controlledAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        lines: [
          {
            id: lineId,
            companyId,
            worksheetId: wsId,
            lineNo: 1,
            productId,
            requestedQty: { toString: () => '10' },
            preparedQty: { toString: () => '10' },
            weighedQty: null,
            unit: 'KG',
            lot: null,
            notes: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        id: wsId,
        companyId,
        number: 'WS-2026-0001',
        status: Status.WEIGHED,
        orderId: null,
        workOrderId: null,
        siteId: null,
        notes: null,
        controlResult: null,
        controlNote: null,
        preparedAt: new Date(),
        weighedAt: new Date(),
        controlledAt: null,
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        lines: [
          {
            id: lineId,
            companyId,
            worksheetId: wsId,
            lineNo: 1,
            productId,
            requestedQty: { toString: () => '10' },
            preparedQty: { toString: () => '10' },
            weighedQty: { toString: () => '9.8' },
            unit: 'KG',
            lot: null,
            notes: null,
          },
        ],
      });

    const prepared = await service.prepare(companyId, wsId, {
      lines: [{ id: lineId, qty: 10 }],
    });
    expect(prepared.status).toBe(Status.PREPARED);

    const weighed = await service.weigh(companyId, wsId, {
      lines: [{ id: lineId, qty: 9.8 }],
    });
    expect(weighed.status).toBe(Status.WEIGHED);

    const controlled = await service.control(companyId, wsId, {
      result: 'PASS',
    });
    expect(controlled.status).toBe(Status.CONTROLLED);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: PRODUCTION_EVENT_TYPES.WORKSHEET_CONTROLLED,
      }),
    );
  });

  it('rejects weigh from DRAFT', async () => {
    const { service, prisma } = build();
    prisma.prodWorksheet.findFirst.mockReset().mockResolvedValue({
      id: wsId,
      companyId,
      number: 'WS-2026-0001',
      status: Status.DRAFT,
      orderId: null,
      workOrderId: null,
      siteId: null,
      notes: null,
      controlResult: null,
      controlNote: null,
      preparedAt: null,
      weighedAt: null,
      controlledAt: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      lines: [
        {
          id: lineId,
          companyId,
          worksheetId: wsId,
          lineNo: 1,
          productId,
          requestedQty: { toString: () => '10' },
          preparedQty: null,
          weighedQty: null,
          unit: 'KG',
          lot: null,
          notes: null,
        },
      ],
    });
    await expect(
      service.weigh(companyId, wsId, { lines: [{ id: lineId, qty: 1 }] }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PRD.INVALID_STATUS' }),
    });
  });
});
