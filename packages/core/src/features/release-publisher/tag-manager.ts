import { createTag, pushTags } from '../../shared/git/git-reader.js';
import type { PackageVersionDiff } from '../release-preview/types.js';

export async function createTagsForDiffs(
  diffs: PackageVersionDiff[],
  cwd?: string,
): Promise<Array<{ tagName: string; success: boolean; error?: string }>> {
  const results: Array<{
    tagName: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const diff of diffs) {
    const tagName = `${diff.packageName}@${diff.newVersion}`;
    try {
      await createTag(tagName, `Release ${diff.newVersion}`, cwd);
      results.push({ tagName, success: true });
    } catch (err) {
      results.push({
        tagName,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 推送所有 tag
  if (results.some((r) => r.success)) {
    try {
      await pushTags(cwd);
    } catch {
      // 推送失败不影响已创建的 tag
    }
  }

  return results;
}
