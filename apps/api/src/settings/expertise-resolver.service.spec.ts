import { ExpertiseResolverService } from './expertise-resolver.service';

describe('ExpertiseResolverService', () => {
  const companyId = 'company-demo';

  function build(items: Array<Record<string, unknown>>) {
    const settings = {
      listExpertise: jest.fn().mockResolvedValue({
        companyId,
        pendingExpertCount: items.filter((i) => i.status === 'PENDING_EXPERT')
          .length,
        items,
      }),
    };
    const resolver = new ExpertiseResolverService(settings as never);
    return { resolver, settings };
  }

  it('returns null for PENDING slots — never invents rates', async () => {
    const { resolver } = build([
      {
        key: 'tax.fodec',
        domain: 'tax',
        label: 'FODEC',
        status: 'PENDING_EXPERT',
        valueSummary: null,
        lawRef: null,
        rateBps: null,
        amountMilli: null,
        expertValidatedAt: null,
        writable: true,
        description: '',
        manageHref: null,
        notes: null,
      },
    ]);
    expect(await resolver.getFodec(companyId)).toBeNull();
    expect(await resolver.getValidated(companyId, 'tax.fodec')).toBeNull();
  });

  it('returns VALIDATED FODEC when expert provided value', async () => {
    const { resolver } = build([
      {
        key: 'tax.fodec',
        domain: 'tax',
        label: 'FODEC',
        status: 'VALIDATED',
        valueSummary: '1 %',
        lawRef: 'Expert note',
        rateBps: 100,
        amountMilli: null,
        expertValidatedAt: '2026-09-08T00:00:00.000Z',
        writable: true,
        description: '',
        manageHref: null,
        notes: null,
      },
    ]);
    const fodec = await resolver.getFodec(companyId);
    expect(fodec).toMatchObject({
      valueLabel: '1 %',
      rateBps: 100,
      lawRef: 'Expert note',
    });
  });

  it('HR snapshot lists pending CNSS split keys when empty', async () => {
    const { resolver } = build([
      {
        key: 'hr.cnss.employee',
        status: 'PENDING_EXPERT',
        valueSummary: null,
        domain: 'hr',
        label: 'CNSS salarié',
        lawRef: null,
        rateBps: null,
        amountMilli: null,
        expertValidatedAt: null,
        writable: true,
        description: '',
        manageHref: null,
        notes: null,
      },
      {
        key: 'hr.cnss.employer',
        status: 'PENDING_EXPERT',
        valueSummary: null,
        domain: 'hr',
        label: 'CNSS employeur',
        lawRef: null,
        rateBps: null,
        amountMilli: null,
        expertValidatedAt: null,
        writable: true,
        description: '',
        manageHref: null,
        notes: null,
      },
      {
        key: 'hr.cnss.ceiling',
        status: 'PENDING_EXPERT',
        valueSummary: null,
        domain: 'hr',
        label: 'CNSS plafond',
        lawRef: null,
        rateBps: null,
        amountMilli: null,
        expertValidatedAt: null,
        writable: true,
        description: '',
        manageHref: null,
        notes: null,
      },
      {
        key: 'hr.irpp',
        status: 'PENDING_EXPERT',
        valueSummary: null,
        domain: 'hr',
        label: 'IRPP',
        lawRef: null,
        rateBps: null,
        amountMilli: null,
        expertValidatedAt: null,
        writable: true,
        description: '',
        manageHref: null,
        notes: null,
      },
      {
        key: 'hr.tfp',
        status: 'PENDING_EXPERT',
        valueSummary: null,
        domain: 'hr',
        label: 'TFP',
        lawRef: null,
        rateBps: null,
        amountMilli: null,
        expertValidatedAt: null,
        writable: true,
        description: '',
        manageHref: null,
        notes: null,
      },
    ]);
    const snap = await resolver.getHrContributionSnapshot(companyId);
    expect(snap.cnssEmployee).toBeNull();
    expect(snap.cnssEmployer).toBeNull();
    expect(snap.cnssCeiling).toBeNull();
    expect(snap.pendingKeys).toEqual(
      expect.arrayContaining([
        'hr.cnss.employee',
        'hr.cnss.employer',
        'hr.cnss.ceiling',
        'hr.irpp',
        'hr.tfp',
        'hr.foprolos',
      ]),
    );
    expect(snap.foprolos).toBeNull();
  });
});
