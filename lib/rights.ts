import type { Rights } from "./types";
export function classifyRights(
  statement = "",
  url = "",
  explicit?: "public-domain" | "cc0",
  evidence = "Source rights statement",
): Rights {
  const text = `${statement} ${url}`.toLowerCase();
  const base: Rights = {
    category: "unknown",
    rightsLabel: "Check source",
    rightsDescription:
      statement || "No explicit image rights statement was supplied.",
    rightsUrl: url || undefined,
    isPublicDomain: false,
    isCC0: false,
    commercialUseStatus: "unknown",
    requiresAttribution: false,
    evidence,
    licenseName: statement || undefined,
    licenseUrl: url || undefined,
  };
  // Restrictive terms take precedence over incidental mentions of open licenses.
  if (
    /\bnon.?commercial\b|\bcc.by.nc\b|\/by-nc|all rights reserved|copyrighted|in copyright|permission required|not (?:in the )?public domain/.test(
      text,
    )
  )
    return {
      ...base,
      category: "restricted",
      commercialUseStatus: "restricted",
    };
  if (
    explicit === "cc0" ||
    /\bcc0\b|creativecommons.org\/publicdomain\/zero\//.test(text)
  )
    return {
      ...base,
      category: "cc0",
      rightsLabel: "CC0",
      isPublicDomain: true,
      isCC0: true,
      commercialUseStatus: "allowed",
    };
  if (
    explicit === "public-domain" ||
    /^public domain(?:\.|$)/i.test(statement.trim()) ||
    /creativecommons.org\/publicdomain\/mark\//.test(url)
  )
    return {
      ...base,
      category: "public-domain",
      rightsLabel: "Public domain",
      isPublicDomain: true,
      commercialUseStatus: "allowed",
    };
  if (
    /^cc[ -]by(?:[ -]sa|[ -]nd)?(?:[ -]\d(?:\.\d)?)?$/i.test(
      statement.trim(),
    ) ||
    /^https:\/\/creativecommons.org\/licenses\/by(?:-sa|-nd)?\/\d/.test(url)
  )
    return {
      ...base,
      category: "attribution",
      rightsLabel: "Attribution required",
      commercialUseStatus: "allowed",
      requiresAttribution: true,
    };
  return base;
}
