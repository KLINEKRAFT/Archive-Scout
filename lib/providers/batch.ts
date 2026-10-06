// Bound archive metadata requests and keep one bad record from losing a page.
export async function mapRecords<T, R>(
  records: T[],
  fn: (r: T) => Promise<R>,
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(records.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, records.length) }, async () => {
      while (next < records.length) {
        const index = next++;
        try {
          results[index] = await fn(records[index]);
        } catch {
          /* omit inaccessible records */
        }
      }
    }),
  );
  return results.filter((r): r is R => r !== undefined);
}
