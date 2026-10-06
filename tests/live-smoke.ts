import { providers } from "../lib/providers";
import { defaultQuery, queryFromText } from "../lib/query";
import { filterAndRank } from "../lib/search";
const queries = [
  "1950s Christmas",
  "1960s advertising",
  "Santa Claus 1957",
  "atomic age",
  "mid century travel",
  "department store Christmas",
  "vintage motel",
  "space race",
  "Christmas illustration",
  "holiday packaging",
  "1960s typography",
];
async function main() {
  for (const text of queries) {
    const q = queryFromText(text, defaultQuery);
    const ids =
      text === "1950s Christmas" ? Object.keys(providers) : ["loc", "aic"];
    const summary = [];
    for (const id of ids) {
      try {
        const r = await providers[id as keyof typeof providers].search(
          q,
          AbortSignal.timeout(18000),
        );
        const filtered = filterAndRank(r.items, q);
        summary.push({
          provider: id,
          status: r.status,
          loaded: r.items.length,
          matchingEra: filtered.length,
          hasMore: r.hasMore,
        });
      } catch (e) {
        summary.push({ provider: id, status: "unavailable" });
      }
    }
    console.log(JSON.stringify({ query: text, results: summary }));
  }
}
void main();
