import { deriveFeatureUi } from './feature-ui-axes';

describe('deriveFeatureUi (C16 / D301)', () => {
  it('maps module DISABLED to HIDDEN / all axes false', () => {
    const result = deriveFeatureUi({
      moduleEnabled: false,
      flagOn: true,
      required: true,
    });
    expect(result.flagState).toBe('HIDDEN');
    expect(result.ui).toEqual({
      available: false,
      visible: false,
      enabled: false,
      required: true,
    });
  });

  it('maps module ON + flag OFF to OFF / available only', () => {
    const result = deriveFeatureUi({
      moduleEnabled: true,
      flagOn: false,
    });
    expect(result.flagState).toBe('OFF');
    expect(result.ui).toEqual({
      available: true,
      visible: false,
      enabled: false,
      required: false,
    });
  });

  it('maps module ON + flag ON to ON / pack axes true', () => {
    const result = deriveFeatureUi({
      moduleEnabled: true,
      flagOn: true,
    });
    expect(result.flagState).toBe('ON');
    expect(result.ui).toEqual({
      available: true,
      visible: true,
      enabled: true,
      required: false,
    });
  });
});
