import type { Octokit } from 'octokit';

/**
 * Octokit 实例类型
 * 使用 typeof Octokit 的实例类型，获得完整的类型安全
 */
export type OctokitInstance = InstanceType<typeof Octokit>;

/**
 * PR 数据类型（来自 Octokit REST API）
 * 所有字段均为可选，以兼容 Octokit 的实际返回类型
 */
export interface PullRequestData {
  number?: number;
  title?: string;
  body?: string | null;
  html_url?: string;
  base?: {
    ref?: string;
    sha?: string;
  };
  head?: {
    ref?: string;
    sha?: string;
  };
  user?: {
    login?: string;
  } | null;
}

/**
 * Issue 评论数据类型
 * 所有字段均为可选，以兼容 Octokit 的实际返回类型
 */
export interface IssueCommentData {
  id?: number;
  body?: string | null;
  user?: {
    login?: string;
  } | null;
  created_at?: string;
}
