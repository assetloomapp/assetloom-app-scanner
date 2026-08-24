// The catalog shipped with the tool. It is public: `clients` may contain ONLY
// vendor-published client IDs — every entry must carry a comment citing where
// the vendor publishes the ID, since a catalog match exempts the app from
// `--risky`. Org-internal or tenant-observed IDs belong in a user's own copy,
// never here. `node scripts/verify-catalog.ts` cross-checks entries against
// Google's OAuth endpoint (a consistency lint, not proof of identity).

export type CatalogEntry = {
  name: string;
  category: string;
  reputation?: "suspicious";
};

export const clients: Record<string, CatalogEntry> = {
  // https://assetloom.app — redirect_uri https://assetloom.app/api/v1/auth/google/redirect
  "847644118553-lpcthupvijaa6f86f8be16lamkimm4ed.apps.googleusercontent.com": {
    name: "AssetLoom",
    category: "productivity",
  },
  // Ships in the Google Cloud SDK distributed by Google (https://cloud.google.com/sdk):
  // lib/googlecloudsdk/core/config.py, CLOUDSDK_CLIENT_ID. Check your own
  // install: grep CLOUDSDK_CLIENT_ID "$(gcloud info --format='value(installation.sdk_root)')/lib/googlecloudsdk/core/config.py"
  "32555940559.apps.googleusercontent.com": {
    name: "Google Cloud SDK",
    category: "google",
  },
  // Also ships in the Google Cloud SDK: lib/googlecloudsdk/api_lib/auth/util.py,
  // DEFAULT_CREDENTIALS_DEFAULT_CLIENT_ID (used by `gcloud auth application-default login`).
  "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com": {
    name: "Google Auth Library",
    category: "google",
  },
  // Firebase CLI: src/api.ts, clientId.
  // https://github.com/firebase/firebase-tools/blob/master/src/api.ts
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com": {
    name: "Firebase CLI",
    category: "google",
  },

  // The entries below were read off the vendor's own login page: the
  // "Sign in with Google" flow the vendor's domain serves carries the client
  // ID, and the redirect_uri points back at that domain.

  // https://id.atlassian.com/login — redirect_uri on id.atlassian.com
  "596149463257-9oquqfivs9on8t8erq23c8qso6vk3cp1.apps.googleusercontent.com": {
    name: "Atlassian",
    category: "productivity",
  },
  // https://app.vanta.com — redirect_uri https://app.vanta.com/auth/google/callback
  "690752614462-i765709385cocut1thvutg8aml4l0ss8.apps.googleusercontent.com": {
    name: "Vanta",
    category: "security",
  },
  // https://claude.ai/login — Google Identity Services popup, origin claude.ai
  "1062961139910-l2m55cb9h51u5cuc9c56eb3fevouidh9.apps.googleusercontent.com": {
    name: "Claude",
    category: "ai",
  },
  // claude.ai Google Drive connector (MCP) — redirect_uri https://claude.ai/api/mcp/auth_callback
  "25663159623-1soas5jk7k62d6tni7oulrjeib95j4dc.apps.googleusercontent.com": {
    name: "Claude for Google Drive",
    category: "ai",
  },
  // claude.ai Google Calendar connector (MCP) — redirect_uri https://claude.ai/api/mcp/auth_callback
  "181481259367-kqbftmnd121er1dmpvss7l4bjfpt5c3n.apps.googleusercontent.com": {
    name: "Claude for Google Calendar",
    category: "ai",
  },
  // claude.ai Gmail connector (MCP) — redirect_uri https://claude.ai/api/mcp/auth_callback
  "101988054943-3c90eajaph0d76bpa6bejkf74hhdatpq.apps.googleusercontent.com": {
    name: "Claude for Gmail",
    category: "ai",
  },
  // https://www.figma.com/login — redirect_uri https://www.figma.com/finish_google_sso
  "532352704633-6pkces9iboppp465idnovkcqtlsa8j7t.apps.googleusercontent.com": {
    name: "Figma",
    category: "design",
  },
  // https://taskford.app — redirect_uri https://taskford.app/api/v1/auth/google/redirect
  "1042183674708-7q4c6nab6rm73mtegtjlm5ubopf9g1vj.apps.googleusercontent.com": {
    name: "TaskFord",
    category: "productivity",
  },
  // https://github.com/login — redirect_uri https://github.com/sessions/social/google/callback
  "1078992815106-brpsupgvhheqg35tupphbh0qk9c32nq8.apps.googleusercontent.com": {
    name: "GitHub",
    category: "developer",
  },
  // https://slack.com/signin — redirect_uri on oauth2.slack.com
  "606092904014-s1u3idjanlbhr4ns5b1hcjgfn63cr9nh.apps.googleusercontent.com": {
    name: "Slack",
    category: "communication",
  },

  // https://chatgpt.com — redirect_uri https://auth.openai.com/api/accounts/callback/google
  "799222349882-ne3i0s9jdm5s0p7ll2d7tlsi1vc1halt.apps.googleusercontent.com": {
    name: "OpenAI",
    category: "ai",
  },
  // https://accounts.x.ai/sign-in — redirect_uri https://accounts.x.ai/exchange-token/
  "455662147616-fai32tqkrc0mqkouoe6l0suk287lkb1k.apps.googleusercontent.com": {
    name: "xAI",
    category: "ai",
  },
  // https://cursor.com sign-in — redirect_uri on authenticate.cursor.sh
  "808146626909-aaokorph2nd0ul0g1l957p7dh3s2535n.apps.googleusercontent.com": {
    name: "Cursor",
    category: "ai",
  },
  // https://www.grammarly.com — redirect_uri https://www.grammarly.com/social/redirect
  "913728339568-tjccmfojammmqs9q0kunokb507mpjqum.apps.googleusercontent.com": {
    name: "Grammarly",
    category: "ai",
  },
  // https://fireflies.ai — redirect_uri https://user-service-rest.fireflies.ai/auth/google
  "964235282027-liib5ar4gi98crc4u3eomaa4cl0et8lg.apps.googleusercontent.com": {
    name: "Fireflies.ai",
    category: "ai",
  },
  // https://copilot.microsoft.com — redirect_uri https://auth.copilot.microsoft.com/login/callback
  "293702255113-5edfm31r2gdeamh7uhlkf6ol4s8vrj1b.apps.googleusercontent.com": {
    name: "Microsoft Copilot",
    category: "ai",
  },
  // https://elevenlabs.io — redirect_uri https://elevenlabs.io/__/auth/handler
  "265222077342-m6lu8il6hbrbmlbalmde5n4pimeda4ki.apps.googleusercontent.com": {
    name: "ElevenLabs",
    category: "ai",
  },
  // https://chat.deepseek.com — redirect_uri https://chat.deepseek.com/api/v0/users/oauth/google/callback
  "205977709770-3d0am349pfuhpv45soo1qt5o6h7cbofk.apps.googleusercontent.com": {
    name: "DeepSeek",
    category: "ai",
  },
  // https://blackforestlabs.ai — redirect_uri https://auth.bfl.ai/oauth
  "175269620837-s4itr5519c08975s48cqfjm351b7rmvo.apps.googleusercontent.com": {
    name: "Black Forest Labs",
    category: "ai",
  },
  // https://www.perplexity.ai — redirect_uri https://www.perplexity.ai/api/auth/callback/google
  "60244564555-30175ip7vg79fobh0rk1sur3pdutj9l1.apps.googleusercontent.com": {
    name: "Perplexity",
    category: "ai",
  },
  // https://akool.com — redirect_uri https://akool.com/interface/user-api/api/v6/auth/google/callback
  "976370978399-4or840visekafm0ursh895k67luuut8u.apps.googleusercontent.com": {
    name: "AKOOL",
    category: "ai",
  },
  // https://chatlyai.app — Google Identity Services popup, origin chatlyai.app
  "810287210002-3muq5aq7qibf3fpulk2vmnn3t43hqie5.apps.googleusercontent.com": {
    name: "Chatly",
    category: "ai",
  },
  // https://dreamina.capcut.com — redirect_uri https://dreamina.capcut.com/third-party-callback
  "585230750835-c88rnn8kjhkvlgpqt9qo7tf07qkhdnis.apps.googleusercontent.com": {
    name: "Dreamina",
    category: "ai",
  },
  // https://dictanote.co — redirect_uri https://dictanote.co/accounts/google/login/callback/
  "391416317693.apps.googleusercontent.com": {
    name: "Dictanote",
    category: "ai",
  },
  // https://www.canva.com/login — redirect_uri https://www.canva.com/oauth/authorized/google
  "779010036194-lf6spugv22vvj41pqjdj4d8k2tq7o5fd.apps.googleusercontent.com": {
    name: "Canva",
    category: "design",
  },
  // https://www.notion.so/login — redirect_uri https://app.notion.com/googlepopupcallback
  "905154081809-858sm3f0qnalqd9d44d9gecjtrdji9tf.apps.googleusercontent.com": {
    name: "Notion",
    category: "productivity",
  },
  // https://www.producthunt.com — redirect_uri https://www.producthunt.com/auth/google_oauth2/callback
  "648403538140-p6el61t69925lqu04sb5f86gvsp306or.apps.googleusercontent.com": {
    name: "Product Hunt",
    category: "social",
  },
  // https://identity.getpostman.com/login — redirect_uri https://identity.getpostman.com/google/oauth2/callback
  "805864674475-3abs2rivkn7kreou30b8ru8esnti4oih.apps.googleusercontent.com": {
    name: "Postman",
    category: "developer",
  },
  // https://auth.monday.com/login — redirect_uri https://googleauth.monday.com/users/auth/google_oauth2/callback
  "44696711958-cahl3l3fii75rvfe5mmvcr3gsp056fm3.apps.googleusercontent.com": {
    name: "monday.com",
    category: "productivity",
  },
  // https://www.linkedin.com/login — Google one-tap, redirect on www.linkedin.com
  "990339570472-k6nqn1tpmitg8pui82bfaun3jrpmiuhs.apps.googleusercontent.com": {
    name: "LinkedIn",
    category: "social",
  },
  // https://calendly.com/app/login — redirect_uri https://calendly.com/users/auth/google_oauth2/callback
  "797340822162.apps.googleusercontent.com": {
    name: "Calendly",
    category: "productivity",
  },
  // https://dash.cloudflare.com/login — redirect_uri on oidc.iam.cfapi.net (Cloudflare's auth domain)
  "1034003232994-78jdt2bv843b5dnud06q2cogp3musu6m.apps.googleusercontent.com": {
    name: "Cloudflare Dashboard",
    category: "developer",
  },
  // https://app.clickup.com/login — Google Identity Services popup, origin app.clickup.com
  "160935175114-q0lsak3umpv1bker5j4nhevhuvn70aeg.apps.googleusercontent.com": {
    name: "ClickUp",
    category: "productivity",
  },
  // https://login.tailscale.com/login — redirect_uri https://login.tailscale.com/a/oauth_response
  "674241127656-lmq9su4p8ni1tcpuh6eqidoornqtvmvi.apps.googleusercontent.com": {
    name: "Tailscale",
    category: "developer",
  },
  // https://app.netbird.io — redirect_uri https://login.netbird.io/login/callback
  "292407264034-tl1dhiktjgklb0ut1eiujropscjr778h.apps.googleusercontent.com": {
    name: "NetBird",
    category: "developer",
  },
  // https://login.docker.com — redirect_uri https://login.docker.com/login/callback
  "3184575537-tf95nnku8tt78ucno0oskepmu27t95k9.apps.googleusercontent.com": {
    name: "Docker",
    category: "developer",
  },
  // https://x.com — Google Identity Services popup, origin x.com
  "49625052041-kgt0hghf445lmcmhijv46b715m2mpbct.apps.googleusercontent.com": {
    name: "X",
    category: "social",
  },
  // https://app.asana.com/-/login — redirect_uri https://app.asana.com/-/oauth
  "1032199425885-oq9scukspijc682n7k2erv386nc58que.apps.googleusercontent.com": {
    name: "Asana",
    category: "productivity",
  },
  // https://dashboard.stripe.com/login — redirect_uri https://dashboard.stripe.com/login/oauth/google/callback
  "76947576630-mmnmnaikmn72ov4fc6imrtoo5pnqj5jp.apps.googleusercontent.com": {
    name: "Stripe",
    category: "finance",
  },
  // https://zoom.us/signin — redirect_uri https://zoom.us/google/oauth
  "849883241272-ed6lnodi1grnoomiuknqkq2rbvd2udku.apps.googleusercontent.com": {
    name: "Zoom",
    category: "communication",
  },
  // https://www.g2.com/login — redirect_uri https://www.g2.com/auth/google_oauth2/callback
  "87100480928-udhoik0du4hehd0imchb6uopbn6vscam.apps.googleusercontent.com": {
    name: "G2",
    category: "social",
  },
};

export const namePatterns: { pattern: string; category: string }[] = [
  { pattern: "chatgpt|openai", category: "ai" },
  { pattern: "claude|anthropic", category: "ai" },
  { pattern: "gemini", category: "ai" },
  { pattern: "perplexity", category: "ai" },
  { pattern: "copilot", category: "ai" },
  { pattern: "deepseek", category: "ai" },
  { pattern: "grammarly", category: "ai" },
  { pattern: "otter\\.ai|fireflies|read\\.ai|fathom", category: "ai" },
  { pattern: "elevenlabs", category: "ai" },
  { pattern: "cursor|windsurf", category: "ai" },
  { pattern: "xai|grok", category: "ai" },
  { pattern: "slack", category: "communication" },
  { pattern: "zoom", category: "communication" },
  { pattern: "notion", category: "productivity" },
  { pattern: "asana|trello|monday", category: "productivity" },
  { pattern: "atlassian|jira|confluence|bitbucket", category: "productivity" },
  { pattern: "clickup|airtable|calendly|taskford", category: "productivity" },
  { pattern: "dropbox|box", category: "storage" },
  { pattern: "figma|canva", category: "design" },
  { pattern: "github|gitlab", category: "developer" },
  {
    pattern: "postman|docker|ngrok|tailscale|browserstack|cloudflare",
    category: "developer",
  },
  { pattern: "vanta|snyk", category: "security" },
];
