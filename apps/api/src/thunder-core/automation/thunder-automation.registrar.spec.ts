import { ThunderAutomationRegistrar } from './thunder-automation.registrar';
import {
  THUNDER_AUTOMATION_CONSUMER_ID,
  THUNDER_AUTOMATION_EVENT_TYPES,
} from './thunder-automation.constants';

describe('ThunderAutomationRegistrar (D289)', () => {
  it('registers consumer for portal / overdue / WA / TEJ events', () => {
    const register = jest.fn();
    const registrar = new ThunderAutomationRegistrar(
      { register } as never,
      { isEnabled: jest.fn() } as never,
      { suggestFromEvent: jest.fn() } as never,
    );
    registrar.onModuleInit();
    expect(register).toHaveBeenCalledWith(
      THUNDER_AUTOMATION_CONSUMER_ID,
      expect.any(Function),
      {
        consumes: [
          THUNDER_AUTOMATION_EVENT_TYPES.portalPaymentDeclarationSubmitted,
          THUNDER_AUTOMATION_EVENT_TYPES.financeOpenItemCreated,
          THUNDER_AUTOMATION_EVENT_TYPES.salesWaInboxDraftCreated,
          THUNDER_AUTOMATION_EVENT_TYPES.taxTejPackPrepared,
          THUNDER_AUTOMATION_EVENT_TYPES.salesOrderConfirmed,
        ],
      },
    );
  });

  it('no-ops when automation module disabled', async () => {
    const suggestFromEvent = jest.fn();
    const registrar = new ThunderAutomationRegistrar(
      { register: jest.fn() } as never,
      { isEnabled: jest.fn().mockResolvedValue(false) } as never,
      { suggestFromEvent } as never,
    );
    await registrar.onEvent({
      eventId: 'e1',
      eventType: THUNDER_AUTOMATION_EVENT_TYPES.taxTejPackPrepared,
      companyId: 'c1',
      aggregateId: 'tej-1',
      payload: {},
    } as never);
    expect(suggestFromEvent).not.toHaveBeenCalled();
  });
});
