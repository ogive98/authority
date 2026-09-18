import { listConfigurationCatalog } from './configuration-catalog';

describe('configuration catalog', () => {
  it('discovers keys without values and marks expertise as critical', () => {
    const catalog = listConfigurationCatalog();
    const vat = catalog.find((item) => item.key === 'tax.vat');
    const locale = catalog.find((item) => item.key === 'ui.locale');
    const smtp = catalog.find((item) => item.key === 'identity.smtp.pass');
    const backupEnabled = catalog.find((item) => item.key === 'backup.enabled');
    const backupRestore = catalog.find(
      (item) => item.key === 'backup.restore.requireElevatedPermission',
    );

    expect(vat?.source).toBe('expertise');
    expect(vat?.risk).toBe('critical');
    expect(vat).not.toHaveProperty('value');
    expect(locale?.risk).toBe('low');
    expect(locale?.allowedValues).toContain('fr-TN');
    expect(smtp?.secret).toBe(true);
    expect(smtp?.ai.configurable).toBe(false);
    expect(backupEnabled?.source).toBe('company');
    expect(backupEnabled?.risk).toBe('high');
    expect(backupRestore?.risk).toBe('critical');
    expect(catalog.every((item) => item.canonicalId.startsWith('cfg.'))).toBe(
      true,
    );
  });
});
