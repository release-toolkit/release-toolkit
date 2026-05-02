import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface PRSnapshot {
  prNumber: number;
  title: string;
  releaseLog: string | null;
  savedAt: string;
}

export function aggregateLogs(cwd?: string): string {
  const basePath = cwd || process.cwd();
  const snapshotDir = resolve(basePath, '.release-toolkit', 'changelog', 'prs');

  if (!existsSync(snapshotDir)) {
    return '*暂无 PR 日志快照，请在开发分支 PR 中填写 RELEASE-LOG 标记区。*';
  }

  const files = readdirSync(snapshotDir).filter((f) => f.startsWith('pr-') && f.endsWith('.json'));
  const snapshots: PRSnapshot[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(resolve(snapshotDir, file), 'utf-8');
      snapshots.push(JSON.parse(content) as PRSnapshot);
    } catch {
      // 忽略损坏的快照文件
    }
  }

  snapshots.sort((a, b) => a.prNumber - b.prNumber);

  const lines: string[] = [];
  for (const snap of snapshots) {
    lines.push(`### PR #${snap.prNumber}: ${snap.title}`);
    if (snap.releaseLog) {
      lines.push('');
      lines.push(snap.releaseLog);
    }
    lines.push('');
  }

  return lines.join('\n') || '*暂无有效 PR 日志。*';
}
