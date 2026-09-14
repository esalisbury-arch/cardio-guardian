// Guards against locale drift: every language must define the exact same
// set of keys (so a missing Spanish translation doesn't silently fall back
// to a raw key like "history.filters.all" on screen), and every key's
// interpolation variables (the {{name}} placeholders) must match across
// languages, since a mismatched variable name means i18next just prints the
// placeholder literally instead of the interpolated value.

import en from '../src/i18n/locales/en.json';
import es from '../src/i18n/locales/es.json';

type JsonTree = { [key: string]: string | JsonTree };

function flattenKeys(obj: JsonTree, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : flattenKeys(value, path);
  });
}

function flattenValues(obj: JsonTree, prefix = ''): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      acc[path] = value;
    } else {
      Object.assign(acc, flattenValues(value, path));
    }
    return acc;
  }, {});
}

function interpolationVars(str: string): string[] {
  return [...str.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
}

describe('i18n locale files', () => {
  const enKeys = flattenKeys(en as JsonTree).sort();
  const esKeys = flattenKeys(es as JsonTree).sort();
  const enValues = flattenValues(en as JsonTree);
  const esValues = flattenValues(es as JsonTree);

  it('en and es define exactly the same set of keys', () => {
    expect(esKeys).toEqual(enKeys);
  });

  it('every key has non-empty English text', () => {
    for (const key of enKeys) {
      expect(enValues[key].length).toBeGreaterThan(0);
    }
  });

  it('every key has non-empty Spanish text', () => {
    for (const key of esKeys) {
      expect(esValues[key].length).toBeGreaterThan(0);
    }
  });

  it('interpolation variables match between en and es for every shared key', () => {
    const mismatches = enKeys
      .filter((key) => key in esValues)
      .map((key) => ({ key, en: interpolationVars(enValues[key]), es: interpolationVars(esValues[key]) }))
      .filter(({ en: enVars, es: esVars }) => JSON.stringify(enVars) !== JSON.stringify(esVars));

    expect(mismatches).toEqual([]);
  });
});
