import { readFileSync } from "node:fs";
import { mapLimit, withRetry } from "../utils.ts";
import type { Grant, ScanResult, UserRecord } from "./types.ts";

// Delegated OAuth consent grant (Microsoft Graph oauth2PermissionGrant).
// clientId/principalId are directory OBJECT ids, not application (client) ids.
type EntraGrant = {
  clientId?: string;
  consentType?: string; // "Principal" (one user) or "AllPrincipals" (admin consent)
  principalId?: string | null;
  scope?: string | null; // space-separated
};

type EntraServicePrincipal = { appId?: string; displayName?: string };

type EntraUser = { id?: string; userPrincipalName?: string };

export type EntraKey = {
  tenant?: string;
  clientId?: string;
  clientSecret?: string;
  // overrides for national clouds (e.g. login.microsoftonline.us) and tests
  loginUrl?: string;
  graphUrl?: string;
};

export type EntraClient = {
  // data is the parsed JSON body (Graph pages carry value + @odata.nextLink)
  get: (path: string) => Promise<unknown>;
};

export function createEntraClient(keyFile: string): EntraClient {
  const key = JSON.parse(readFileSync(keyFile, "utf8")) as EntraKey;
  if (!key.tenant || !key.clientId || !key.clientSecret)
    throw new Error(
      `${keyFile} must contain "tenant", "clientId" and "clientSecret" — run 'assetloom-app-scanner config entra'`,
    );
  return entraClient(key);
}

export async function fetchGraphToken(key: EntraKey): Promise<string> {
  const loginUrl = key.loginUrl ?? "https://login.microsoftonline.com";
  const res = await fetch(`${loginUrl}/${key.tenant}/oauth2/v2.0/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: key.clientId ?? "",
      client_secret: key.clientSecret ?? "",
      scope: `${key.graphUrl ?? "https://graph.microsoft.com"}/.default`,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token)
    throw Object.assign(
      new Error(
        `token request failed: ${res.status} ${body.error_description ?? body.error ?? res.statusText}`,
      ),
      { status: res.status },
    );
  return body.access_token;
}

export function entraClient(key: EntraKey): EntraClient {
  const graphUrl = key.graphUrl ?? "https://graph.microsoft.com";
  // ponytail: token fetched once per run, no expiry refresh — scans finish
  // well inside the ~1h token lifetime; add refresh-on-401 if that changes
  let token: string | undefined;
  return {
    get: async (path) => {
      token ??= await fetchGraphToken(key);
      const res = await fetch(path.includes("://") ? path : graphUrl + path, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!res.ok)
        throw Object.assign(
          new Error(`GET ${path} failed: ${res.status} ${res.statusText}`),
          { status: res.status },
        );
      return res.json();
    },
  };
}

async function getAll<T>(client: EntraClient, path: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | undefined = path;
  while (next) {
    const res = (await withRetry(() => client.get(next as string))) as {
      value?: T[];
      "@odata.nextLink"?: string;
    };
    items.push(...(res.value ?? []));
    next = res["@odata.nextLink"];
  }
  return items;
}

export async function scanEntra(
  client: EntraClient,
  opts: {
    concurrency?: number;
    log?: (msg: string, level?: "info" | "warn") => void;
    progress?: (done: number, total: number, label: string) => void;
  } = {},
): Promise<ScanResult> {
  const log = opts.log ?? ((msg: string) => console.error(msg));
  const raw = await getAll<EntraGrant>(
    client,
    "/v1.0/oauth2PermissionGrants?$top=999",
  );
  log(`Fetched ${raw.length} OAuth permission grants...`, "info");

  const spIds = [
    ...new Set(raw.map((g) => g.clientId).filter(Boolean)),
  ] as string[];
  const userIds = [
    ...new Set(
      raw
        .filter((g) => g.consentType !== "AllPrincipals")
        .map((g) => g.principalId)
        .filter(Boolean),
    ),
  ] as string[];

  const sps = new Map<string, EntraServicePrincipal>();
  const users = new Map<string, UserRecord>();
  let errors = 0;
  let done = 0;
  const total = spIds.length + userIds.length;
  const concurrency = opts.concurrency ?? 10;
  await mapLimit(spIds, concurrency, async (id) => {
    try {
      const sp = (await withRetry(() =>
        client.get(`/v1.0/servicePrincipals/${id}?$select=appId,displayName`),
      )) as EntraServicePrincipal;
      sps.set(id, sp);
    } catch (err) {
      errors++;
      log(`app fetch failed for ${id}: ${(err as Error).message ?? err}`);
    }
    opts.progress?.(++done, total, sps.get(id)?.displayName ?? id);
  });
  await mapLimit(userIds, concurrency, async (id) => {
    try {
      const u = (await withRetry(() =>
        client.get(`/v1.0/users/${id}?$select=id,userPrincipalName`),
      )) as EntraUser;
      users.set(id, { id, email: u.userPrincipalName ?? id });
    } catch (err) {
      errors++;
      log(`user fetch failed for ${id}: ${(err as Error).message ?? err}`);
    }
    opts.progress?.(++done, total, users.get(id)?.email ?? id);
  });

  const grants: Grant[] = [];
  for (const g of raw) {
    if (!g.clientId) continue;
    const sp = sps.get(g.clientId);
    const app = {
      // the global application (client) id is what the catalog matches on;
      // fall back to the service principal object id when unresolvable
      clientId: sp?.appId ?? g.clientId,
      displayName: sp?.displayName ?? g.clientId,
    };
    const scopes = (g.scope ?? "").split(/\s+/).filter(Boolean);
    if (g.consentType === "AllPrincipals" || !g.principalId) {
      grants.push({
        userId: "all-users",
        userEmail: "all users (admin consent)",
        app,
        scopes,
      });
    } else {
      const u = users.get(g.principalId);
      grants.push({
        userId: g.principalId,
        userEmail: u?.email ?? g.principalId,
        app,
        scopes,
      });
    }
  }
  return { users: [...users.values()], grants, errors };
}
