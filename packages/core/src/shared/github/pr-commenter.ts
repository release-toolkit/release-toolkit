import type { GithubContext } from '../types.js';
import {
  createPRComment,
  getPRComments,
  updatePRComment,
} from './api-client.js';

const DEFAULT_START = '<!-- release-toolkit-report-start -->';
const DEFAULT_END = '<!-- release-toolkit-report-end -->';

export interface PRCommenterOptions {
  markerStart?: string;
  markerEnd?: string;
}

export async function postOrUpdateComment(
  context: GithubContext,
  body: string,
  options?: PRCommenterOptions,
): Promise<void> {
  const start = options?.markerStart ?? DEFAULT_START;
  const end = options?.markerEnd ?? DEFAULT_END;

  const wrappedBody = `${start}\n${body}\n${end}`;

  const { data: comments } = await getPRComments(context);

  const existing = comments.find((c) => {
    const bodyStr = (c as Record<string, unknown>).body as string;
    return typeof bodyStr === 'string' && bodyStr.includes(start);
  });

  if (existing) {
    await updatePRComment(
      context,
      existing.id as number,
      wrappedBody,
    );
  } else {
    await createPRComment(context, wrappedBody);
  }
}
