import { GithubContext } from '../types.js';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

export class GithubContextDetector {
  /** Detect GitHub Actions environment and parse context */
  detect(): GithubContext {
    const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

    if (!isGitHubActions) {
      return {
        isGitHubActions: false,
        eventName: '',
        sha: process.env.CI_SHA || '',
        ref: process.env.CI_REF || '',
      };
    }

    // Parse event payload
    let eventPayload: Record<string, unknown> = {};
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (eventPath && existsSync(eventPath)) {
      try {
        eventPayload = JSON.parse(readFileSync(eventPath, 'utf-8'));
      } catch (error) {
        console.error('[GithubContextDetector] Failed to parse GITHUB_EVENT_PATH:', error);
      }
    }

    // Extract PR number
    let prNumber: number | undefined;
    if (eventPayload.pull_request) {
      prNumber = (eventPayload.pull_request as Record<string, unknown>).number as
        | number
        | undefined;
    }
    // Fallback: extract from ref like refs/pull/123/merge
    if (!prNumber && process.env.GITHUB_REF) {
      const match = /refs\/pull\/(\d+)\//.exec(process.env.GITHUB_REF);
      if (match) {
        prNumber = parseInt(match[1], 10);
      }
    }

    // Parse repository
    const repoStr = process.env.GITHUB_REPOSITORY || '';
    const [repoOwner, repoName] = repoStr.split('/');

    // Determine base ref/sha from event or env
    const baseRef = this.extractBaseRef(eventPayload);
    const baseSha = this.extractBaseSha(eventPayload);

    return {
      isGitHubActions: true,
      eventName: process.env.GITHUB_EVENT_NAME || '',
      sha: process.env.GITHUB_SHA || '',
      ref: process.env.GITHUB_REF || '',
      baseRef,
      baseSha,
      prNumber,
      repoOwner,
      repoName,
      token: process.env.GITHUB_TOKEN,
    };
  }

  private extractBaseRef(event: Record<string, unknown>): string | undefined {
    // From pull_request event
    if (event.pull_request) {
      const pr = event.pull_request as Record<string, unknown>;
      const base = pr.base as Record<string, unknown> | undefined;
      if (base?.ref) return base.ref as string;
    }

    // Fallback to environment variable
    return process.env.GITHUB_BASE_REF || undefined;
  }

  private extractBaseSha(event: Record<string, unknown>): string | undefined {
    // From pull_request event
    if (event.pull_request) {
      const pr = event.pull_request as Record<string, unknown>;
      const base = pr.base as Record<string, unknown> | undefined;
      if (base?.sha) return base.sha as string;
    }

    // Fallback to environment variable
    return process.env.GITHUB_BASE_SHA || undefined;
  }
}
