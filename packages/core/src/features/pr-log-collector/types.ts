export interface PRLogCollectorOptions {
  prNumber: number;
  owner: string;
  repo: string;
  token?: string;
  cwd?: string;
  save?: boolean;
}

export interface PRLogCollectorResult {
  success: boolean;
  prNumber: number;
  title: string;
  releaseLog: string | null;
  commentPosted: boolean;
  savedPath?: string;
  error?: string;
}

export interface PRMeta {
  number: number;
  title: string;
  body: string | null;
  baseRef: string;
  headRef: string;
}
