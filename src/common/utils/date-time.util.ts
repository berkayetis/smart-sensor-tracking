export function asIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
