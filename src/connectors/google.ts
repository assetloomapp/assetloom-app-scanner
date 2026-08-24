import { google } from "googleapis";
import { mapLimit, withRetry } from "../utils.ts";
import type { Grant, ScanResult, UserRecord } from "./types.ts";

type UsersListResponse = {
  data: {
    users?: Array<{ id?: string | null; primaryEmail?: string | null }>;
    nextPageToken?: string | null;
  };
};

type TokensListResponse = {
  data: {
    items?: Array<{
      clientId?: string | null;
      displayText?: string | null;
      scopes?: string[] | null;
    }>;
  };
};

export type DirectoryApi = {
  users: {
    list: (params: Record<string, unknown>) => Promise<UsersListResponse>;
  };
  tokens: {
    list: (params: { userKey: string }) => Promise<TokensListResponse>;
  };
};

const SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
  "https://www.googleapis.com/auth/admin.directory.user.security",
];

export function createDirectory(
  keyFile: string,
  impersonate: string,
): DirectoryApi {
  const auth = new google.auth.JWT({
    keyFile,
    scopes: SCOPES,
    subject: impersonate,
  });
  return google.admin({
    version: "directory_v1",
    auth,
  }) as unknown as DirectoryApi;
}

export async function scanDirectory(
  dir: DirectoryApi,
  opts: {
    domain?: string;
    concurrency?: number;
    log?: (msg: string) => void;
    progress?: (done: number, total: number, email: string) => void;
  } = {},
): Promise<ScanResult> {
  const log = opts.log ?? ((msg: string) => console.error(msg));
  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const res = await withRetry(() =>
      dir.users.list({
        ...(opts.domain
          ? { domain: opts.domain }
          : { customer: "my_customer" }),
        maxResults: 500,
        pageToken,
      }),
    );
    for (const u of res.data.users ?? []) {
      if (u.id && u.primaryEmail)
        users.push({ id: u.id, email: u.primaryEmail });
    }
    pageToken = res.data.nextPageToken ?? undefined;
    log(`Fetched ${users.length} users...`);
  } while (pageToken);

  const grants: Grant[] = [];
  let errors = 0;
  let done = 0;
  await mapLimit(users, opts.concurrency ?? 10, async (user) => {
    try {
      const res = await withRetry(() => dir.tokens.list({ userKey: user.id }));
      for (const t of res.data.items ?? []) {
        if (!t.clientId) continue;
        grants.push({
          userId: user.id,
          userEmail: user.email,
          app: {
            clientId: t.clientId,
            displayName: t.displayText ?? t.clientId,
          },
          scopes: t.scopes ?? [],
        });
      }
    } catch (err) {
      errors++;
      log(
        `token fetch failed for ${user.email}: ${(err as Error).message ?? err}`,
      );
    }
    opts.progress?.(++done, users.length, user.email);
  });
  return { users, grants, errors };
}
