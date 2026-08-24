export type UserRecord = { id: string; email: string };

export type AppInfo = { clientId: string; displayName: string };

export type Grant = {
  userId: string;
  userEmail: string;
  app: AppInfo;
  scopes: string[];
};

export type RiskLevel = "low" | "medium" | "high";

export type Classification = {
  category: string;
  riskLevel: RiskLevel;
  // 'catalog' = client ID verified; 'name' = display-name heuristic only —
  // names are attacker-chosen, so 'name' must never exempt an app from --risky
  classifiedBy: "catalog" | "name" | "unknown";
};

export type ScanResult = {
  users: UserRecord[];
  grants: Grant[];
  errors: number;
};
