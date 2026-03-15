export function mapRecords<TRecord, TDto>(
  records: TRecord[],
  mapper: (record: TRecord) => TDto,
): TDto[] {
  return records.map(mapper);
}
