# version

版本检测 — 对比 base 和 HEAD 的 `package.json` 版本差异。

## PackageScanner

使用 `semver.diff` 检测各包的版本变更类型（major/minor/patch）。

## 使用

```ts
import { PackageScanner } from './version-diff-detector.js';

const scanner = new PackageScanner(cwd);
const diffs = await scanner.detectVersionDiffs('main');
// diffs: [{ package: { packageName, packagePath, currentVersion, newVersion }, diffType }]

console.log(PackageScanner.formatReport(diffs));
```
