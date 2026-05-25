interface GitHubAppEnv {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_TOKEN?: string;
}

export interface GitHubPullRequest {
  number?: number;
  title?: string;
  body?: string | null;
  base?: {
    ref?: string;
  };
  head?: {
    ref?: string;
    sha?: string;
  };
}

export interface GitHubIssueComment {
  id?: number;
  body?: string | null;
  created_at?: string;
}

export interface GitHubRepoContentFile {
  type: 'file';
  content: string;
}

interface GitHubCompareFile {
  filename: string;
}

interface CachedInstallationToken {
  token: string;
  expiresAt: number;
}

export interface GitHubClient {
  getPullRequest(ctx: { owner: string; repo: string; prNumber: number }): Promise<GitHubPullRequest>;
  listIssueComments(ctx: {
    owner: string;
    repo: string;
    issueNumber: number;
  }): Promise<GitHubIssueComment[]>;
  createIssueComment(ctx: {
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<void>;
  updateIssueComment(ctx: {
    owner: string;
    repo: string;
    commentId: number;
    body: string;
  }): Promise<void>;
  updatePullRequest(ctx: {
    owner: string;
    repo: string;
    prNumber: number;
    body: string;
  }): Promise<void>;
  getRepoContent(ctx: {
    owner: string;
    repo: string;
    path: string;
    ref: string;
  }): Promise<GitHubRepoContentFile | null>;
  compareCommits(ctx: {
    owner: string;
    repo: string;
    baseRef: string;
    headRef: string;
  }): Promise<{ files: GitHubCompareFile[] }>;
  createWorkflowDispatch(ctx: {
    owner: string;
    repo: string;
    workflowFile: string;
    ref: string;
    inputs: Record<string, string>;
  }): Promise<void>;
}

const installationTokenCache = new Map<string, CachedInstallationToken>();
const GITHUB_API_BASE = 'https://api.github.com';

function decodePem(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signJwt(privateKeyPem: string, payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encoder = new TextEncoder();
  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    decodePem(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1] ?? null;
}

function encodeRepoPath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text || response.statusText}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  headers: Record<string, string>,
): Promise<{ data: T; response: Response }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...headers,
      ...(init.headers ?? {}),
    },
  });
  const data = await parseJsonResponse<T>(response);
  return { data, response };
}

async function getInstallationAccessToken(
  env: GitHubAppEnv,
  installationId: number,
): Promise<string | null> {
  const appId = env.GITHUB_APP_ID;
  const privateKey = env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) {
    return env.GITHUB_TOKEN ?? null;
  }

  const cacheKey = `${appId}:${installationId}`;
  const cached = installationTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(privateKey, {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  });

  const { data } = await requestJson<{ token: string; expires_at: string }>(
    `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
    { method: 'POST' },
    { Authorization: `Bearer ${jwt}` },
  );

  installationTokenCache.set(cacheKey, {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime(),
  });
  return data.token;
}

function createAuthHeaders(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function createGitHubClient(
  env: GitHubAppEnv,
  installationId?: number,
): Promise<GitHubClient> {
  const token =
    typeof installationId === 'number'
      ? await getInstallationAccessToken(env, installationId)
      : env.GITHUB_TOKEN ?? null;
  const authHeaders = createAuthHeaders(token);

  return {
    async getPullRequest({ owner, repo, prNumber }) {
      const { data } = await requestJson<GitHubPullRequest>(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`,
        { method: 'GET' },
        authHeaders,
      );
      return data;
    },

    async listIssueComments({ owner, repo, issueNumber }) {
      const comments: GitHubIssueComment[] = [];
      let nextUrl: string | null =
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`;

      while (nextUrl) {
        const { data, response } = await requestJson<GitHubIssueComment[]>(
          nextUrl,
          { method: 'GET' },
          authHeaders,
        );
        comments.push(...data);
        nextUrl = parseNextLink(response.headers.get('Link'));
      }

      return comments;
    },

    async createIssueComment({ owner, repo, issueNumber, body }) {
      await requestJson<unknown>(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ body }),
        },
        authHeaders,
      );
    },

    async updateIssueComment({ owner, repo, commentId, body }) {
      await requestJson<unknown>(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/comments/${commentId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ body }),
        },
        authHeaders,
      );
    },

    async updatePullRequest({ owner, repo, prNumber, body }) {
      await requestJson<unknown>(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ body }),
        },
        authHeaders,
      );
    },

    async getRepoContent({ owner, repo, path, ref }) {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeRepoPath(path)}?ref=${encodeURIComponent(ref)}`;
      const { data } = await requestJson<GitHubRepoContentFile | GitHubRepoContentFile[]>(
        url,
        { method: 'GET' },
        authHeaders,
      );
      return Array.isArray(data) || data.type !== 'file' ? null : data;
    },

    async compareCommits({ owner, repo, baseRef, headRef }) {
      const { data } = await requestJson<{ files?: GitHubCompareFile[] }>(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/compare/${encodeURIComponent(baseRef)}...${encodeURIComponent(headRef)}`,
        { method: 'GET' },
        authHeaders,
      );
      return { files: data.files ?? [] };
    },

    async createWorkflowDispatch({ owner, repo, workflowFile, ref, inputs }) {
      await requestJson<unknown>(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
        {
          method: 'POST',
          body: JSON.stringify({ ref, inputs }),
        },
        authHeaders,
      );
    },
  };
}
