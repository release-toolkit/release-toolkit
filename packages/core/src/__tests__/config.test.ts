import { describe, it, expect } from 'vitest'

describe('config module', () => {
  it('should be able to import config module', async () => {
    const configModule = await import('../shared/config/index.js')
    expect(configModule).toBeDefined()
    expect(configModule.loadConfig).toBeDefined()
    expect(typeof configModule.loadConfig).toBe('function')
  })

  it('should export DEFAULT_CONFIG', async () => {
    const { DEFAULT_CONFIG } = await import('../shared/config/index.js')
    expect(DEFAULT_CONFIG).toBeDefined()
  })

  it('should export CONFIG_DIR and CONFIG_FILE', async () => {
    const { CONFIG_DIR, CONFIG_FILE } = await import('../shared/config/index.js')
    expect(CONFIG_DIR).toBeDefined()
    expect(CONFIG_FILE).toBeDefined()
  })
})
