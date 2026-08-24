import { clients, namePatterns as patternDefs } from "./catalog/apps.ts";
import type { Classification, RiskLevel } from "./connectors/types.ts";
import { maxRisk } from "./rules.ts";

const namePatterns = patternDefs.map((p) => ({
  re: new RegExp(p.pattern, "i"),
  category: p.category,
}));

export function classify(
  clientId: string,
  displayName: string,
  scopes: string[],
): Classification {
  const scopeLevel: RiskLevel = maxRisk(scopes);
  const entry = clients[clientId];
  if (entry) {
    return {
      category: entry.category,
      riskLevel: entry.reputation === "suspicious" ? "high" : scopeLevel,
      classifiedBy: "catalog",
    };
  }
  const match = namePatterns.find((p) => p.re.test(displayName));
  if (match) {
    return {
      category: match.category,
      riskLevel: scopeLevel,
      classifiedBy: "name",
    };
  }
  return {
    category: "unknown",
    riskLevel: scopeLevel,
    classifiedBy: "unknown",
  };
}
