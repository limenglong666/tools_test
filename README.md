# Tools

汇集各类实用小工具，**一个工具一个文件夹**。

**工具首页**：仓库根目录 [`index.html`](index.html)（部署后访问站点根路径 `/`），可从首页跳转到各个工具。

## 工具列表

| 工具 | 目录 | 说明 |
|------|------|------|
| EIP-712 Debugger | [`ethereum-eip712/`](ethereum-eip712/) | 在以太坊 / EVM 链上调试 EIP-712 结构化签名 |
| Browser ↔ Table Compare | [`browser-table-compare/`](browser-table-compare/) | CSV 验证器 CL Rewards 与 beaconcha.in Validator History 对比 |

## 本地运行

**请在仓库根目录**启动服务（不要在子工具文件夹里 `serve`，否则 `http://localhost:3456` 会直接进入某个工具，而不是工具首页）：

```bash
cd /path/to/tools_test   # 仓库根目录
npm start
# 或：npx --yes serve -p 3456
```

- 工具首页：`http://localhost:3456/`
- EIP-712 Debugger：`http://localhost:3456/ethereum-eip712/`
- Browser ↔ Table Compare：`http://localhost:3456/browser-table-compare/`

## 添加新工具

1. 在根目录新建文件夹，例如 `my-tool/`
2. 放入 `index.html` 及该工具所需资源
3. 可选：添加 `my-tool/README.md` 说明用法
4. 在根目录 `index.html` 和本 README 的工具列表中登记

## 部署

根目录 `vercel.json` 已配置为静态站点，部署后各工具可通过对应子路径访问。
