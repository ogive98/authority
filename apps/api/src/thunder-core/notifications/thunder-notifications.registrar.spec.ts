import { ThunderNotificationsRegistrar } from './thunder-notifications.registrar';
import {
  THUNDER_NOTIFICATIONS_CONSUMER_ID,
  THUNDER_NOTIFICATIONS_EVENT_TYPES,
} from './thunder-notifications.constants';

describe('ThunderNotificationsRegistrar (D290)', () => {
  it('registers materialize consumer', () => {
    const register = jest.fn();
    const registrar = new ThunderNotificationsRegistrar(
      { register } as never,
      { sync: jest.fn() } as never,
    );
    registrar.onModuleInit();
    expect(register).toHaveBeenCalledWith(
      THUNDER_NOTIFICATIONS_CONSUMER_ID,
      expect.any(Function),
      {
        consumes: expect.arrayContaining([
          THUNDER_NOTIFICATIONS_EVENT_TYPES.salesOrderConfirmed,
          THUNDER_NOTIFICATIONS_EVENT_TYPES.taxTejPackPrepared,
          THUNDER_NOTIFICATIONS_EVENT_TYPES.automationRunCreated,
        ]),
      },
    );
  });

  it('calls NotificationsService.sync', async () => {
    const sync = jest.fn().mockResolvedValue({ upserted: 1, reconciled: 0 });
    const registrar = new ThunderNotificationsRegistrar(
      { register: jest.fn() } as never,
      { sync } as never,
    );
    await registrar.onEvent({
      eventId: 'e1',
      eventType: THUNDER_NOTIFICATIONS_EVENT_TYPES.salesOrderConfirmed,
      companyId: 'c1',
      aggregateId: 'ord-1',
      payload: {},
    } as never);
    expect(sync).toHaveBeenCalledWith('c1');
  });
});
