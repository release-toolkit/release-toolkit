# @release-toolkit/cli

命令行工具，快速接入 CI 环境进行版本检测和 changelog 生成。

## 使用

```bash
# 直接运行（无需安装）
npx @release-toolkit/cli ci --base-ref origin/main

# 检测版本变化并生成 changelog
npx @release-toolkit/cli ci --base-ref origin/main --repo-url https://github.com/org/repo

# 输出到文件
npx @release-toolkit/cli ci --base-ref origin/main --output ./CHANGELOG.md
```

## 命令

### `release ci`

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--base-ref` | 基准分支 | `origin/main` |
| `--repo-url` | GitHub 仓库地址 | - |
| `--output` | changelog 输出路径 | 控制台输出 |
| `--plugins` | 启用的插件 | 内置插件 |

## 依赖

- `@release-toolkit/core` - 核心功能
- `@release-toolkit/changelog-presets` - 内置格式化插件
