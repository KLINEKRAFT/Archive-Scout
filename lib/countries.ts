import type { ArchiveItem, ProviderId } from "./types";
export const COUNTRIES = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["FR", "France"],
  ["NZ", "New Zealand"],
  ["AT", "Austria"],
  ["BE", "Belgium"],
  ["BG", "Bulgaria"],
  ["HR", "Croatia"],
  ["CY", "Cyprus"],
  ["CZ", "Czech Republic"],
  ["DK", "Denmark"],
  ["EE", "Estonia"],
  ["FI", "Finland"],
  ["DE", "Germany"],
  ["GR", "Greece"],
  ["HU", "Hungary"],
  ["IS", "Iceland"],
  ["IE", "Ireland"],
  ["IT", "Italy"],
  ["LV", "Latvia"],
  ["LT", "Lithuania"],
  ["LU", "Luxembourg"],
  ["MT", "Malta"],
  ["NL", "Netherlands"],
  ["NO", "Norway"],
  ["PL", "Poland"],
  ["PT", "Portugal"],
  ["RO", "Romania"],
  ["RS", "Serbia"],
  ["SK", "Slovakia"],
  ["SI", "Slovenia"],
  ["ES", "Spain"],
  ["SE", "Sweden"],
  ["CH", "Switzerland"],
] as const;
export function countryCodes(values: string[]): string[] {
  return [
    ...new Set(
      values.flatMap((v) => {
        const match = COUNTRIES.find(
          ([code, name]) =>
            code === v.toUpperCase() || name.toLowerCase() === v.toLowerCase(),
        );
        return match ? [match[0]] : [];
      }),
    ),
  ];
}
export function providerCountries(id: ProviderId): string[] {
  if (id === "vam") return ["GB"];
  if (id === "gallica") return ["FR"];
  if (id === "digitalnz") return ["NZ"];
  return [
    "loc",
    "dpla",
    "smithsonian",
    "aic",
    "cma",
    "met",
    "tulsa",
    "oklahoma",
    "nasa",
  ].includes(id)
    ? ["US"]
    : [];
}
export function matchesCountry(item: ArchiveItem, countries: string[]) {
  return (
    !countries.length ||
    (item.archiveCountries || providerCountries(item.provider)).some((c) =>
      countries.includes(c),
    )
  );
}
