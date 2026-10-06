export async function json(
  url: string,
  signal: AbortSignal,
  credentials: Record<string, string> = {},
): Promise<any> {
  const response = await fetch(url, {
    signal,
    redirect: Object.keys(credentials).length ? "error" : "follow",
    headers: {
      "User-Agent": process.env.ARCHIVE_USER_AGENT || "ArchiveScout/0.1",
      Accept: "application/json",
      ...credentials,
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
