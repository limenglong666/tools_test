/**
 * 在 beaconcha.in 验证器页面打开 DevTools Console，粘贴并运行此脚本。
 * 会拉取 Validator Income Detail History 并复制 JSON 到剪贴板。
 *
 * 用法：
 * 1. 打开 https://beaconcha.in/validator/<pubkey>
 * 2. 切到 Validator History 所在页面（同一 URL 即可）
 * 3. Console 中运行本脚本（可修改 startEpoch / endEpoch）
 */
(async function extractBeaconchaValidatorHistory() {
  const pathPart = location.pathname.split("/").filter(Boolean).pop() || "";
  const pubkey = pathPart.startsWith("0x") ? pathPart : prompt("输入验证器 Public Key（0x…）");
  if (!pubkey) return;

  const startEpoch = Number(prompt("起始 Epoch", "457380"));
  const endEpoch = Number(prompt("结束 Epoch", "457394"));
  if (!Number.isFinite(startEpoch) || !Number.isFinite(endEpoch) || startEpoch > endEpoch) {
    alert("Epoch 范围无效");
    return;
  }

  const limit = endEpoch - startEpoch + 1;
  const apikey = prompt("beaconcha API Key（可选，在 beaconcha.in/user/settings 创建）") || "";

  let url =
    `/api/v1/validator/${encodeURIComponent(pubkey)}/incomedetailhistory` +
    `?latest_epoch=${endEpoch}&limit=${limit}`;
  if (apikey) url += `&apikey=${encodeURIComponent(apikey)}`;

  const res = await fetch(url);
  const json = await res.json();
  if (json.status && json.status.startsWith("ERROR")) {
    console.error(json);
    alert("API 错误：" + json.status);
    return;
  }

  const text = JSON.stringify(json, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert(`已复制 ${json.data?.length ?? 0} 条 epoch 数据到剪贴板，请粘贴到对比工具。`);
  } catch {
    console.log(text);
    alert("无法写入剪贴板，JSON 已输出到 Console。");
  }
  console.log(json);
})();
