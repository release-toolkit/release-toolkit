# 修复 Cloudflare Workers 部署问题

## 问题描述

部署 `app-server` 到 Cloudflare Workers 时失败，错误信息提示缺少 `node:` 模块。

## 问题根因

`app-server` 依赖 `@release-toolkit/core` 包，而 `core` 包内部使用了以下 Node.js 特有 API：

- `node:fs` - 文件系统操作
- `node:child_process` - 执行 shell 命令
- `node:module` 的 `createRequire` - 动态加载模块
- `js-yaml` - YAML 解析（依赖 Node.js）

Cloudflare Workers 是无服务器环境，不支持这些 Node.js API。

## 解决方案

**方案：内联核心函数，移除对 core 包的依赖**

1. **分析实际依赖**
   - `app-server` 只需要 `extractReleaseLog` 和 `OUTPUT_MARKERS`
   - 这两个函数都是纯函数，不依赖任何 Node.js API

2. **内联代码**
   - 将 `extractReleaseLog` 和 `OUTPUT_MARKERS` 直接复制到 `app-server/src/index.ts`
   - 移除 `import { extractReleaseLog, OUTPUT_MARKERS } from '@release-toolkit/core'`

3. **简化 tsdown 配置**
   - 移除不再需要的 alias 配置
   - 保留 `bundle: true` 和 `external: []` 确保所有依赖被打包

## 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `packages/app-server/src/index.ts` | 内联 `extractReleaseLog` 和 `OUTPUT_MARKERS` |
| `packages/app-server/tsdown.config.ts` | 移除 alias 配置 |

## 验证结果

```bash
# 检查构建后的文件不包含 Node.js API
cat dist/index.mjs | grep -E "node:|createRequire"
# 输出为空 = 成功

# 部署成功
wrangler deploy dist/index.mjs --name release-toolkit --compatibility-date 2026-01-01
# Deployed release-toolkit triggers (1.05 sec)
# https://release-toolkit.jimmyrss1102.workers.dev
```
