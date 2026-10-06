export async function json(url: string, signal: AbortSignal): Promise<any> {
  const response = await fetch(url, {
    signal,
    headers: {
      "User-Agent": process.env.ARCHIVE_USER_AGENT || "ArchiveScout/0.1",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Archive returned HTTP ${response.status}`);
  return response.json();
}
export const params = (data: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
