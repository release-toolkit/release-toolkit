/**
 * Cloudflare Worker 兼容的 GitHub REST 轻量客户端
 *
 * 仅服务于 `release-publisher/tag-manager.ts` 在 Worker 环境创建 tag 的场景。
 * 其它 GitHub API 调用请使用 `shared/github/api-client.ts`（基于官方 octokit）。
 */

const BASE_URL = 'https://api.github.com';

export interface OctokitOptions {
  token: string;
  owner: string;
  repo: string;
}

/**
 * 发送 GitHub API 请求
 *
 * 修复要点：
 * - URL 必须以 `/repos/{owner}/{repo}/...` 开头，旧实现漏了 `/repos/` 段会 404
 * - 默认 GitHub REST 返回 JSON 本体（数组或对象），不要再封一层 `{ data }`
 */
async function request<T>(
  endpoint: string,
  options: OctokitOptions,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}/repos/${options.owner}/${options.repo}/${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-API-Version': '2022-11-28',
    'User-Agent': 'release-toolkit',
  };

  let requestBody: RequestInit['body'];
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: requestBody,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

/**
 * 创建 annotated Git Tag
 *
 * 返回 tag 对象的 sha（与 commit sha 不同）。
 * GitHub 要求随后通过 `git/refs` 创建 `refs/tags/{name}` 引用指向此 sha 才能生效。
 */
export async function createTag(
  options: OctokitOptions,
  tagName: string,
  message: string,
  commitSha: string,
  tagType: 'commit' | 'tree' | 'blob' = 'commit',
): Promise<{ sha: string; tag: string }> {
  return request<{ sha: string; tag: string }>(
    'git/tags',
    options,
    'POST',
    {
      tag: tagName,
      message,
      object: commitSha,
      type: tagType,
    },
  );
}

/**
 * 通过 `git/refs` 创建 `refs/tags/{name}` 引用，使 tag 对外可见
 *
 * 修复要点：`ref` 字段必须以 `refs/` 开头，旧实现写成 `tags/${tagName}` 会 422。
 */
export async function pushTag(
  options: OctokitOptions,
  tagName: string,
  sha: string,
): Promise<{ ref: string }> {
  return request<{ ref: string }>(
    'git/refs',
    options,
    'POST',
    {
      ref: `refs/tags/${tagName}`,
      sha,
    },
  );
}

/**
 * 获取指定 ref 的最新 commit SHA
 *
 * 修复要点：GitHub `commits` 端点直接返回 commit 对象数组，
 * 旧实现期望 `{ data: [...] }` 包装会拿不到结果。
 */
export async function getLatestCommitSha(
  options: OctokitOptions,
  ref: string = 'main',
): Promise<string> {
  const data = await request<Array<{ sha: string }>>(
    `commits?sha=${encodeURIComponent(ref)}&per_page=1`,
    options,
  );
  return data[0]?.sha ?? '';
}
