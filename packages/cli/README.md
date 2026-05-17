# @release-toolkit/cli

CLI 入口，提供 `release` 命令调用核心功能。

## 使用

```bash
pnpm dlx @release-toolkit/cli --help
```

## 命令

| 命令 | 说明 |
|------|------|
| `release preview` | 执行发布预览（检测版本变更 + 聚合日志） |
| `release publish` | 执行发布（创建 Tags + GitHub Release + 钩子） |

## 发布流程钩子

publish 命令按以下顺序执行：

1. **beforePublish** - 插件钩子
2. **beforeTag** - 配置的钩子（创建 tag 前）
3. **createTags** - 创建 Git Tags
4. **createRelease** - 创建 GitHub Release
5. **afterRelease** - 配置的钩子（发布后）
6. **afterPublish** - 插件钩子

## 示例

```bash
# GitHub Actions 中使用
- name: Release Preview
  run: |
    pnpm dlx @release-toolkit/cli preview

- name: Release Publisher
  run: |
    pnpm dlx @release-toolkit/cli publish
```

## API

```typescript
import { previewRelease, publishRelease } from '@release-toolkit/cli';
```

详见 [架构文档](https://github.com/release-toolkit/release-toolkit/tree/dev/docs/architecture)
