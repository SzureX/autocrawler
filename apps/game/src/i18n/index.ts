import pl from './pl.json';

export type Messages = Record<string, string>;

const catalogs: Record<string, Messages> = { pl };
let current: Messages = pl;

export function setLocale(locale: string): void {
  current = catalogs[locale] ?? pl;
}

/** Translates a key; `{name}` placeholders are replaced from params. Missing keys return the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = current[key];
  if (template === undefined) return key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = params[name];
    return v === undefined ? whole : String(v);
  });
}

export function hasKey(key: string): boolean {
  return key in current;
}

export function allKeys(): string[] {
  return Object.keys(current);
}
