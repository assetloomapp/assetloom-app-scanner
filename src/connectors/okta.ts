import { readFileSync } from "node:fs";
import { mapLimit, withRetry } from "../utils.ts";
import type { Grant, ScanResult, UserRecord } from "./types.ts";

type OktaApp = {
  id?: string;
  name?: string;
  label?: string;
  credentials?: { oauthClient?: { client_id?: string } };
};

type OktaAppUser = {
  id?: string;
  credentials?: { userName?: string };
};

export type OktaClient = {
  // data is the parsed JSON array; next is the opaque next-page URL/path, if any
  get: (path: string) => Promise<{ data: unknown; next?: string }>;
};

export function parseNextLink(header: string | null): string | undefined {
  return header?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
}

/**
 * Turn whatever the user pastes — an Admin Console URL, a bare subdomain, an
 * org URL with a path — into the org base URL. The Admin Console lives on
 * `{tenant}-admin.*`, but API calls go to the plain org domain.
 */
export function normalizeOrgUrl(input: string): string {
  let s = input.trim();
  if (!s.includes(".") && !s.includes("/")) s = `${s}.okta.com`;
  if (!s.includes("://")) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new Error(`invalid Okta org URL: ${input}`);
  }
  return url.origin.replace(/^(https?:\/\/[^./]+)-admin\./, "$1.");
}

/** Admin Console page where API tokens are created. */
export function adminTokenUrl(org: string): string {
  const admin = org.replace(
    /^(https:\/\/[^./]+)\.(okta\.com|oktapreview\.com|okta-emea\.com)$/,
    "$1-admin.$2",
  );
  return `${admin}/admin/access/api/tokens`;
}

export function createOktaClient(keyFile: string): OktaClient {
  const key = JSON.parse(readFileSync(keyFile, "utf8")) as {
    org?: string;
    token?: string;
  };
  if (!key.org || !key.token)
    throw new Error(
      `${keyFile} must contain "org" (e.g. https://acme.okta.com) and "token" (an Okta API token)`,
    );
  return oktaClient(normalizeOrgUrl(key.org), key.token);
}

export function oktaClient(org: string, token: string): OktaClient {
  return {
    get: async (path) => {
      const res = await fetch(path.includes("://") ? path : org + path, {
        headers: {
          Authorization: `SSWS ${token}`,
          Accept: "application/json",
        },
      });
      if (!res.ok)
        throw Object.assign(
          new Error(`GET ${path} failed: ${res.status} ${res.statusText}`),
          {
            status: res.status,
          },
        );
      return {
        data: await res.json(),
        next: parseNextLink(res.headers.get("link")),
      };
    },
  };
}

async function getAll<T>(client: OktaClient, path: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | undefined = path;
  while (next) {
    const res = await withRetry(() => client.get(next as string));
    items.push(...(res.data as T[]));
    next = res.next;
  }
  return items;
}

export async function scanOkta(
  client: OktaClient,
  opts: {
    concurrency?: number;
    log?: (msg: string, level?: "info" | "warn") => void;
    progress?: (done: number, total: number, label: string) => void;
  } = {},
): Promise<ScanResult> {
  const log = opts.log ?? ((msg: string) => console.error(msg));
  const apps = await getAll<OktaApp>(
    client,
    `/api/v1/apps?limit=200&filter=${encodeURIComponent('status eq "ACTIVE"')}`,
  );
  log(`Fetched ${apps.length} active apps...`, "info");

  const usersById = new Map<string, UserRecord>();
  const grants: Grant[] = [];
  let errors = 0;
  let done = 0;
  await mapLimit(apps, opts.concurrency ?? 10, async (app) => {
    const label = app.label ?? app.name ?? app.id ?? "?";
    try {
      if (!app.id) return;
      const appUsers = await getAll<OktaAppUser>(
        client,
        `/api/v1/apps/${app.id}/users?limit=200`,
      );
      for (const au of appUsers) {
        if (!au.id) continue;
        const email = au.credentials?.userName ?? au.id;
        usersById.set(au.id, { id: au.id, email });
        grants.push({
          userId: au.id,
          userEmail: email,
          app: {
            // SSO assignments carry no OAuth scopes; catalog matching is by
            // OIDC client_id when the app has one, by name otherwise
            clientId: app.credentials?.oauthClient?.client_id ?? app.id,
            displayName: label,
          },
          scopes: [],
        });
      }
    } catch (err) {
      errors++;
      log(`user fetch failed for ${label}: ${(err as Error).message ?? err}`);
    }
    opts.progress?.(++done, apps.length, label);
  });
  return { users: [...usersById.values()], grants, errors };
}
