import { load } from 'js-yaml';
import { createOctokit } from './github/api-client.js';
import type { OctokitInstance } from './github/types.js';

export interface WorkspaceConfig {
  packages: string[];
}

/** 解析 pnpm-workspace.yaml（或同类）文本中的 packages 字段 */
export function parseWorkspacePackages(content: string): string[] {
  const data = load(content) as WorkspaceConfig | null;
  return data?.packages ?? [];
}

export interface WorkspaceApiContext {
  owner: string;
  repo: string;
  /** 分支名或 commit SHA */
  ref: string;
  token?: string;
}

function decodeContentBase64(content: string): string {
  return typeof Buffer !== 'undefined'
    ? Buffer.from(content, 'base64').toString('utf-8')
    : atob(content.replace(/\n/g, ''));
}

/** 使用已有 Octokit 实例读取 workspace 文件 */
export async function fetchWorkspacePackagesWithOctokit(
  octokit: OctokitInstance,
  ctx: Omit<WorkspaceApiContext, 'token'>,
  workspaceFile: string,
): Promise<string[]> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: ctx.owner,
      repo: ctx.repo,
      path: workspaceFile,
      ref: ctx.ref,
    });
    if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
      console.warn(`[workspace] ${workspaceFile} 在 ${ctx.ref} 上不是文件`);
      return [];
    }
    return parseWorkspacePackages(decodeContentBase64(data.content));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[workspace] 无法从 API 读取 ${workspaceFile}：${msg}`);
    return [];
  }
}

/** 从 GitHub 仓库指定 ref 读取 workspace 文件并解析 packages 列表 */
export async function fetchWorkspacePackagesByAPI(
  workspaceFile: string,
  ctx: WorkspaceApiContext,
): Promise<string[]> {
  const octokit = await createOctokit(ctx.token);
  return fetchWorkspacePackagesWithOctokit(octokit, ctx, workspaceFile);
}

/** 从环境变量解析 GitHub 仓库上下文（Worker / Actions 常用） */
export function workspaceContextFromEnv(headRef?: string): WorkspaceApiContext | null {
  const repoFull = process.env.GITHUB_REPOSITORY;
  if (!repoFull) return null;
  const [owner, repo] = repoFull.split('/');
  if (!owner || !repo) return null;
  return {
    owner,
    repo,
    ref: headRef || process.env.GITHUB_SHA || process.env.GITHUB_HEAD_REF_NAME || 'HEAD',
    token: process.env.GITHUB_TOKEN,
  };
}
