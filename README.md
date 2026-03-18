# EIP-712 Debugger（以太坊）

对标 [TIP-712 Debugger](https://blockchain-test-dapp-tip712.vercel.app/) 的流程，在 **以太坊 / EVM 链** 上调试 **EIP-712** 结构化签名。

## 功能

- **连接 / 断开**：展示已连接状态、当前网络名称、完整地址与复制；**断开**会尝试 `wallet_revokePermissions`（不支持时仅清除本页状态）。支持 **账户切换 / 切链** 自动刷新。
- **编辑载荷**：`domain` / `types` / `primaryType` / `message`（JSON）
- **预设样例**（下拉分组）：
  - Mail（规范嵌套示例）
  - **EIP-2612**：USDC、**DAI**（holder/expiry/allowed）、**UNI**
  - **Permit2**：PermitSingle、**PermitBatch**（多 token）、**PermitTransferFrom**
  - **Governor Vote**、**ERC2771 ForwardRequest**
  - **简单 Order**、**NFT Listing**
- **计算 Hash** · **签名** · **验签** · **r/s/v** 拆分（同前）
- **chainId**：模板多为主网 `1`；在其它网络签名时，钱包按**当前链**计算 EIP-712 digest。页面会在签名前把 `domain.chainId` 同步为当前网络，并在已连接时加载预设带上当前链，避免验签地址对不上。
- **验签**：签名请求使用与 MetaMask 相同的 `@metamask/eth-sig-util` 恢复地址；并保存「提交给钱包的 JSON」。验签时请勾选 **「与钱包签名时提交的 JSON」**（签名成功后可选），避免编辑器与当次签名不一致。部分钱包会改写请求，若仍对不上可换 MetaMask 对比。

## 本地打开

```bash
cd Ethereum_EIP712
npx --yes serve -p 3456
```

浏览器访问 `http://localhost:3456`，或直接双击打开 `index.html`（部分浏览器对 `file://` 限制钱包接口，建议用本地 HTTP）。

## 部署到 Vercel

### 方式一：用 Vercel 网页（推荐）

1. 把本仓库推到 **GitHub**（若整个 Sublime 仓库一起推，见下）。
2. 打开 [vercel.com](https://vercel.com) 并登录，点击 **Add New → Project**。
3. 选择该 GitHub 仓库。
4. **重要**：若仓库根目录不是 `Ethereum_EIP712`，在 **Root Directory** 里填 `Ethereum_EIP712` 并点 **Edit** 确认。
5. **Framework Preset** 选 **Other**（或留空），无需 Build Command。
6. 点击 **Deploy**，等完成后会得到 `https://xxx.vercel.app`。

### 方式二：用 Vercel CLI

```bash
cd Ethereum_EIP712
npx vercel
```

按提示登录、选项目或新建，部署完成后会输出访问地址。后续更新可再执行 `npx vercel --prod` 发布到生产。

### 若仓库根就是 Ethereum_EIP712

若你单独建了一个只含 `Ethereum_EIP712` 内容的仓库（根目录直接是 `index.html`、`vercel.json`），则导入时**不用**填 Root Directory，直接 Deploy 即可。

## 说明

- `chainId`、`verifyingContract` 需与当前网络一致时，钱包展示与链上校验才一致。
- 不同代币的 `domain.name` / `version` 以合约为准（本页 USDC 为主网示例）。
