# plugin

插件系统 — 管理和执行 changelog 格式化插件。

## 两阶段管线

| 阶段 | 接口 | 说明 |
|------|------|------|
| Stage 1 | `ILineFormatter` | 逐条转换 entry，返回 `null` 丢弃 |
| Stage 2 | `ILogFormatter` | 后处理整个 changelog 文档结构 |

## 主要导出

| 导出 | 说明 |
|------|------|
| `PluginManager` | 注册/管理内置和自定义插件 |
| `Pipeline` | 按优先级执行两阶段管线 |

## 使用

```ts
import { PluginManager, Pipeline } from './index.js';

const manager = new PluginManager();
manager.loadPlugins(['emoji-prefix', 'category-group']);

const pipeline = new Pipeline(manager);
const output = await pipeline.run(entries, '1.0.0');
```

## 自定义插件

```ts
import { ILineFormatter } from '@release-toolkit/core';

const myPlugin: ILineFormatter = {
  name: 'my-plugin',
  priority: 50,
  __formatterType: 'line',
  format(entry) {
    return { ...entry, subject: entry.subject.toUpperCase() };
  },
};
```
