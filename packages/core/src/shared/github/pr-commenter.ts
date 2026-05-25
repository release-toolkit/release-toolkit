import { isToolCommentBody, wrapToolComment } from '@release-toolkit/markdown';
import type { GithubContext } from '../types.js';
import {
  createPRComment,
  getPRComments,
  updatePRComment,
} from './api-client.js';

export interface PRCommenterOptions {
  markerStart?: string;
  markerEnd?: string;
}

export async function postOrUpdateComment(
  context: GithubContext,
  body: string,
  options?: PRCommenterOptions,
): Promise<void> {
  const customStart = options?.markerStart;
  const customEnd = options?.markerEnd;
  const wrappedBody =
    customStart && customEnd
      ? `${customStart}\n${body}\n${customEnd}`
      : wrapToolComment(body);

  const { data: comments } = await getPRComments(context);

  const existing = comments.find((c) => {
    const bodyStr = (c as Record<string, unknown>).body as string;
    if (typeof bodyStr !== 'string') return false;
    if (customStart) return bodyStr.includes(customStart);
    return isToolCommentBody(bodyStr);
  });

  if (existing) {
    await updatePRComment(context, existing.id as number, wrappedBody);
  } else {
    await createPRComment(context, wrappedBody);
  }
}
