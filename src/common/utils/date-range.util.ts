export function resolveDateRange(
  from?: string,
  to?: string,
  defaultWindowMs = 86400000,
): { fromDate: Date; toDate: Date } {
  const fromDate = from ? new Date(from) : new Date(Date.now() - defaultWindowMs);
  const toDate = to ? new Date(to) : new Date();
  return { fromDate, toDate };
}

export function resolveDateRangeIso(
  from?: string,
  to?: string,
  defaultWindowMs = 86400000,
): { fromIso: string; toIso: string } {
  const { fromDate, toDate } = resolveDateRange(from, to, defaultWindowMs);
  return {
    fromIso: fromDate.toISOString(),
    toIso: toDate.toISOString(),
  };
}
