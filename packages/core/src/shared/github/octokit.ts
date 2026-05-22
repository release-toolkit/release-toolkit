/**
 * Octokit GitHub API 客户端
 * 用于在 Cloudflare Worker 环境中调用 GitHub REST API
 */

const BASE_URL = 'https://api.github.com';

export interface OctokitOptions {
  token: string;
  owner: string;
  repo: string;
}

export interface APIResponse<T> {
  data: T;
  status?: number;
}

/**
 * 发送 GitHub API 请求
 */
async function request<T>(
  endpoint: string,
  options: OctokitOptions,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}/${options.owner}/${options.repo}/${endpoint}`;

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

  return response.json() as T;
}

/**
 * 获取文件内容
 */
export async function getFileContents(
  options: OctokitOptions,
  filePath: string,
  ref?: string,
): Promise<string> {
  const endpoint = ref
    ? `contents/${filePath}?ref=${ref}`
    : `contents/${filePath}`;

  const data = await request<{ content: string; encoding: string }>(
    endpoint,
    options,
  );

  // Base64 解码
  if (data.encoding === 'base64') {
    return atob(data.content);
  }

  return data.content;
}

/**
 * 获取两个 ref 之间的文件差异
 */
export async function compareRefs(
  options: OctokitOptions,
  baseRef: string,
  headRef: string,
): Promise<Array<{ filename: string; status: string }>> {
  const data = await request<{ files: Array<{ filename: string; status: string }> }>(
    `compare/${baseRef}...${headRef}`,
    options,
  );

  return data.files.map((f) => ({
    filename: f.filename,
    status: f.status,
  }));
}

/**
 * 创建 Git Tag
 */
export async function createTag(
  options: OctokitOptions,
  tagName: string,
  message: string,
  sha: string,
  tagType: 'commit' | 'tree' | 'blob' = 'commit',
): Promise<{ name: string }> {
  const data = await request<{ name: string }>(
    'git/tags',
    options,
    'POST',
    {
      tag: tagName,
      message,
      object: sha,
      type: tagType,
    },
  );

  return data;
}

/**
 * 推送 Tag（通过创建引用）
 */
export async function pushTag(
  options: OctokitOptions,
  tagName: string,
  sha: string,
): Promise<{ ref: string }> {
  const data = await request<{ ref: string }>(
    `git/refs`,
    options,
    'POST',
    {
      ref: `tags/${tagName}`,
      sha,
    },
  );

  return data;
}

/**
 * 创建 GitHub Release
 */
export async function createRelease(
  options: OctokitOptions,
  tagName: string,
  name: string,
  body: string,
  draft: boolean = false,
  prerelease: boolean = false,
): Promise<{ url: string; id: number }> {
  const data = await request<{ url: string; id: number }>(
    'releases',
    options,
    'POST',
    {
      tag_name: tagName,
      name,
      body,
      draft,
      prerelease,
    },
  );

  return data;
}

/**
 * 获取 PR 的变更文件列表
 */
export async function getPRFiles(
  options: OctokitOptions,
  prNumber: number,
): Promise<Array<{ filename: string; status: string }>> {
  const data = await request<{ data: Array<{ filename: string; status: string }> }>(
    `pulls/${prNumber}/changed_files`,
    options,
  );

  return data.data;
}

/**
 * 获取最新 commit SHA
 */
export async function getLatestCommitSha(
  options: OctokitOptions,
  ref: string = 'main',
): Promise<string> {
  const data = await request<{ data: Array<{ sha: string }> }>(
    `commits?sha=${ref}&per_page=1`,
    options,
  );

  return data.data[0]?.sha || '';
}

/**
 * 创建 Commit Comment
 */
export async function createCommitComment(
  options: OctokitOptions,
  commitSha: string,
  body: string,
): Promise<{ id: number }> {
  const data = await request<{ id: number }>(
    `commits/${commitSha}/comments`,
    options,
    'POST',
    { body },
  );

  return data;
}

/**
 * 创建 Issue Comment（PR 也是 Issue）
 */
export async function createIssueComment(
  options: OctokitOptions,
  issueNumber: number,
  body: string,
): Promise<{ id: number }> {
  const data = await request<{ id: number }>(
    `issues/${issueNumber}/comments`,
    options,
    'POST',
    { body },
  );

  return data;
}

/**
 * 更新 Issue Comment
 */
export async function updateIssueComment(
  options: OctokitOptions,
  commentId: number,
  body: string,
): Promise<{ id: number }> {
  const data = await request<{ id: number }>(
    `issues/comments/${commentId}`,
    options,
    'PATCH',
    { body },
  );

  return data;
}

/**
 * 查找已有的预览评论（通过评论内容标识）
 */
export async function findPreviewComment(
  options: OctokitOptions,
  issueNumber: number,
  identifier: string,
): Promise<number | null> {
  const data = await request<{ data: Array<{ id: number; body: string }> }>(
    `issues/${issueNumber}/comments`,
    options,
  );

  for (const comment of data.data) {
    if (comment.body.includes(identifier)) {
      return comment.id;
    }
  }

  return null;
}
