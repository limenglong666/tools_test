# Browser ↔ Table Compare

对比本地 **Daily Rewards CSV** 与 [beaconcha.in](https://beaconcha.in) 验证器 **Validator History** 中的 **CL Rewards**。

## 场景

- CSV 每行是一台验证器在某个导出批次中的奖励数据
- 关键列：`Public Key`、`CL Rewards Generated`
- 同一验证器可能有多行（不同导出时间），对比时会**按 Public Key 求和**
- beaconcha.in 侧按指定 **Epoch 区间**（如 457380–457394）汇总每 epoch 的 CL，再与 CSV 对比

## 示例

| 项目 | 值 |
|------|-----|
| 示例 CSV | `02_daily_rewards_2026-06.csv` |
| 示例 Public Key | `0x8001ff793be4d78da2175d4c67b0e51f4862a48c5b5834a9bc1a80e3912a8c52d778b02287605300257f1c6a7ad1f9a2` |
| Validator Index | `1283884` |
| Epoch 范围 | `457380` – `457394` |
| beaconcha 页面 | [打开验证器](https://beaconcha.in/validator/0x8001ff793be4d78da2175d4c67b0e51f4862a48c5b5834a9bc1a80e3912a8c52d778b02287605300257f1c6a7ad1f9a2) |

## 使用步骤

### 1. 启动本地服务

```bash
cd browser-table-compare
npx --yes serve -p 3456
```

打开 `http://localhost:3456/browser-table-compare/`

### 2. 加载 CSV

- 点击「加载示例文件」，或上传自己的 CSV

### 3. 获取 beaconcha 数据

beaconcha.in 有 Cloudflare 保护，需在**浏览器内**获取数据：

**方式 A（推荐）：Console 脚本**

1. 打开 beaconcha.in 上对应验证器页面
2. DevTools → Console（若无法粘贴，先输入 `allow pasting` 回车）
3. 复制并运行 `beaconcha-extract.js` 内容
4. 按提示输入 Epoch 范围（默认 457380–457394）
5. 若需要，填入 [API Key](https://beaconcha.in/user/settings)
6. JSON 会自动复制到剪贴板，粘贴到对比工具

**方式 B：Network 面板**

1. 打开验证器页面，展开 Validator History
2. 在 Network 中找到 `incomedetailhistory` 请求
3. 复制 Response JSON 粘贴到工具

**方式 C：手动逐条粘贴（脚本失败时）**

1. 对比工具切换到 **「手动逐条粘贴」** 标签
2. 从 Validator History 表格直接复制（如 `457448	+8609 GWei`）
3. 每行一条，粘贴到「手动逐条粘贴」区域
4. 粘贴后自动预览 CL 合计，再点「开始对比」

### 4. 对比

填写 Public Key 与 Epoch 范围，点击「开始对比」。

## CL 计算

- **beaconcha CL**：`incomedetailhistory` 各奖励项 − 惩罚项（gwei → ETH）
- **CSV**：同一 Public Key 所有行的 `CL Rewards Generated` 求和

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 对比界面 |
| `compare.js` | CSV / beaconcha 解析与对比逻辑 |
| `beaconcha-extract.js` | 在 beaconcha.in 页面 Console 运行的抓取脚本 |
| `02_daily_rewards_2026-06.csv` | 示例数据 |
