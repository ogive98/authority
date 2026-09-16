import { ExtensionLifecycleService } from './extension-lifecycle.service';

describe('ExtensionLifecycleService (D277)', () => {
  const svc = new ExtensionLifecycleService();

  it('allows DRAFT → ANALYZING', () => {
    expect(svc.canTransitionExtension('DRAFT', 'ANALYZING')).toBe(true);
  });

  it('forbids DRAFT → ACTIVE', () => {
    expect(svc.canTransitionExtension('DRAFT', 'ACTIVE')).toBe(false);
    expect(() => svc.assertExtensionTransition('DRAFT', 'ACTIVE')).toThrow();
  });

  it('allows APPROVED → ACTIVE', () => {
    expect(svc.canTransitionExtension('APPROVED', 'ACTIVE')).toBe(true);
  });

  it('forbids RECEIVED → DEPLOYED for feature requests', () => {
    expect(svc.canTransitionFeatureRequest('RECEIVED', 'DEPLOYED')).toBe(
      false,
    );
  });

  it('allows DRAFT → ACTIVE for metadata; forbids ARCHIVED → ACTIVE', () => {
    expect(svc.canTransitionMetadata('DRAFT', 'ACTIVE')).toBe(true);
    expect(svc.canTransitionMetadata('ARCHIVED', 'ACTIVE')).toBe(false);
  });
});
