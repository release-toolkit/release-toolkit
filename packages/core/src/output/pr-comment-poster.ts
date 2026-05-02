import { COMMENT_ANCHOR_START, COMMENT_ANCHOR_END } from '../constants.js';

export class PRCommentPoster {
  private owner: string;
  private repo: string;
  private token: string;

  constructor(owner: string, repo: string, token: string) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
  }

  /**
   * Create or update a comment on a PR with the release report.
   * Uses anchor markers for idempotent updates.
   */
  async postComment(prNumber: number, body: string): Promise<void> {
    const octokit = await this.getOctokit();
    const anchoredBody = `${COMMENT_ANCHOR_START}\n${body}\n${COMMENT_ANCHOR_END}`;

    // Try to find existing comment by anchor
    const existingId = await this.findExistingComment(octokit, prNumber);

    if (existingId) {
      console.log(`[PRCommentPoster] Updating existing comment #${existingId} on PR #${prNumber}`);
      await octokit.rest.issues.updateComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: existingId,
        body: anchoredBody,
      });
    } else {
      console.log(`[PRCommentPoster] Creating new comment on PR #${prNumber}`);
      await octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        body: anchoredBody,
      });
    }
  }

  private async getOctokit() {
    // Dynamic import - octokit is an optional dependency
    const { Octokit } = await import('octokit');
    return new Octokit({ auth: this.token });
  }

  private async findExistingComment(
    octokit: InstanceType<typeof import('octokit').Octokit>,
    prNumber: number,
  ): Promise<number | null> {
    const comments = await octokit.rest.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      per_page: 100,
    });

    for (const comment of comments.data) {
      if (comment.body?.includes(COMMENT_ANCHOR_START)) {
        return comment.id;
      }
    }

    return null;
  }
}
