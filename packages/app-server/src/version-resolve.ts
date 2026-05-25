import type { GitHubClient } from './github-client.js';
import type { PRContext, VersionDiff } from './format.js';

export function workspaceFileFromConfig(
  config: Record<string, unknown> | null,
): string {
  const preview = config?.releasePreview;
  if (preview && typeof preview === 'object' && 'workspaceFile' in preview) {
    const file = (preview as { workspaceFile?: string }).workspaceFile;
    if (typeof file === 'string' && file.length > 0) return file;
  }
  return 'pnpm-workspace.yaml';
}

function decodeContentBase64(content: string): string {
  return typeof Buffer !== 'undefined'
    ? Buffer.from(content, 'base64').toString('utf-8')
    : atob(content.replace(/\n/g, ''));
}

function parseWorkspacePackages(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const packages: string[] = [];
  let inPackagesSection = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (!inPackagesSection) {
      if (/^packages\s*:\s*$/.test(trimmed)) {
        inPackagesSection = true;
      }
      continue;
    }

    if (!line.startsWith(' ') && !line.startsWith('-')) {
      break;
    }

    const match = trimmed.match(/^-\s+['"]?(.+?)['"]?$/);
    if (match?.[1]) {
      packages.push(match[1]);
    }
  }

  return packages;
}

function matchesWorkspaceFilePath(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  if (patterns.some((p) => p.endsWith('.yaml') || p.endsWith('.yml'))) {
    return filePath.endsWith('/package.json');
  }
  for (const pattern of patterns) {
    const prefix = pattern.endsWith('/*') ? pattern.slice(0, -2) : pattern;
    if (filePath === `${prefix}/package.json` || filePath.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

async function fetchWorkspacePackages(
  client: GitHubClient,
  ctx: { owner: string; repo: string; ref: string },
  workspaceFile: string,
): Promise<string[]> {
  const content = await client.getRepoContent({
    owner: ctx.owner,
    repo: ctx.repo,
    path: workspaceFile,
    ref: ctx.ref,
  });
  if (!content?.content) return [];
  return parseWorkspacePackages(decodeContentBase64(content.content));
}

async function listChangedPackagePaths(
  client: GitHubClient,
  ctx: { owner: string; repo: string; baseRef: string; headRef: string },
  workspacePatterns: string[],
): Promise<string[]> {
  const { files } = await client.compareCommits(ctx);
  const paths = new Set<string>();
  for (const file of files) {
    if (!file.filename.endsWith('/package.json')) continue;
    if (!matchesWorkspaceFilePath(file.filename, workspacePatterns)) continue;
    paths.add(file.filename.replace(/\/package\.json$/, ''));
  }
  return Array.from(paths);
}

async function getPackageJsonAtRef(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<{ name?: string; version?: string } | null> {
  const content = await client.getRepoContent({ owner, repo, path, ref });
  if (!content?.content) return null;
  try {
    return JSON.parse(decodeContentBase64(content.content)) as { name?: string; version?: string };
  } catch {
    return null;
  }
}

async function detectVersionChanges(
  client: GitHubClient,
  ctx: { owner: string; repo: string; baseRef: string; headRef: string },
  workspacePatterns: string[],
): Promise<VersionDiff[]> {
  const changedPaths = await listChangedPackagePaths(client, ctx, workspacePatterns);
  const diffs: VersionDiff[] = [];

  for (const pkgDir of changedPaths) {
    const pkgJsonPath = `${pkgDir}/package.json`;
    const [basePkg, headPkg] = await Promise.all([
      getPackageJsonAtRef(client, ctx.owner, ctx.repo, pkgJsonPath, ctx.baseRef),
      getPackageJsonAtRef(client, ctx.owner, ctx.repo, pkgJsonPath, ctx.headRef),
    ]);

    if (!headPkg?.version) continue;
    const oldVersion = basePkg?.version ?? '0.0.0';
    const newVersion = headPkg.version;
    if (oldVersion === newVersion) continue;

    diffs.push({
      packageName: headPkg.name ?? packagePathToDirName(pkgDir),
      currentVersion: oldVersion,
      newVersion,
    });
  }

  return diffs;
}

/** 目录路径 `packages/foo` → 评论用短名 `foo` */
export function packagePathToDirName(packagePath: string): string {
  return packagePath.split('/').pop() ?? packagePath;
}

/**
 * 与 core 对齐：读 workspace 配置 + Compare API 检测版本变更。
 */
export async function resolvePRVersionState(
  client: GitHubClient,
  prCtx: PRContext,
  repoConfig: Record<string, unknown> | null,
): Promise<{ versionDiffs: VersionDiff[]; changedPackages: string[] }> {
  const workspaceFile = workspaceFileFromConfig(repoConfig);
  const ref = prCtx.headSha || prCtx.headRef;
  const patterns = await fetchWorkspacePackages(
    client,
    { owner: prCtx.owner, repo: prCtx.repo, ref },
    workspaceFile,
  );
  const workspacePatterns = patterns.length > 0 ? patterns : ['packages/*'];

  const versionResults = await detectVersionChanges(
    client,
    {
      owner: prCtx.owner,
      repo: prCtx.repo,
      baseRef: prCtx.baseRef,
      headRef: ref,
    },
    workspacePatterns,
  );

  const allChangedPaths = await listChangedPackagePaths(
    client,
    {
      owner: prCtx.owner,
      repo: prCtx.repo,
      baseRef: prCtx.baseRef,
      headRef: ref,
    },
    workspacePatterns,
  );

  const changedPackages = allChangedPaths.map(packagePathToDirName);

  return {
    versionDiffs: versionResults,
    changedPackages,
  };
}
