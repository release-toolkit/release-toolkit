import { describe, it, expect } from 'vitest'

describe('github module', () => {
  it('should be able to import github context detector', async () => {
    const githubModule = await import('../shared/github/context-detector.js')
    expect(githubModule).toBeDefined()
    expect(githubModule.detectGithubContext).toBeDefined()
    expect(typeof githubModule.detectGithubContext).toBe('function')
  })
})
