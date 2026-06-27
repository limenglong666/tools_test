/**
 * 在 Etherscan 地址页 Console 运行（需 API Key）。
 * 按 Epoch 时间范围汇总 Method=Transfer 的转入 ETH，复制 JSON 到对比工具。
 */
(async function extractEtherscanElTransfers() {
  const DEFAULT_ADDR = "0xee5f5c53ce2159fc6dd4b0571e86a4a390d04846";
  const GENESIS = 1606824023;
  const SLOTS = 32;
  const SLOT_SEC = 12;

  const address = (prompt("监控地址", DEFAULT_ADDR) || DEFAULT_ADDR).trim();
  const startEpoch = Number(prompt("起始 Epoch", "457560"));
  const endEpoch = Number(prompt("结束 Epoch", "457574"));
  const apikey = prompt("Etherscan API Key（https://etherscan.io/apidashboard）") || "";
  if (!apikey) {
    alert("需要 API Key");
    return;
  }

  const startTs = GENESIS + startEpoch * SLOTS * SLOT_SEC;
  const endTs = GENESIS + (endEpoch + 1) * SLOTS * SLOT_SEC - 1;

  async function api(params) {
    const u = new URL("https://api.etherscan.io/v2/api");
    u.searchParams.set("chainid", "1");
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    u.searchParams.set("apikey", apikey);
    const j = await (await fetch(u)).json();
    if (j.status !== "1" && j.message !== "OK") throw new Error(j.result || j.message);
    return j.result;
  }

  const startBlock = Number(await api({ module: "block", action: "getblocknobytime", timestamp: startTs, closest: "before" }));
  const endBlock = Number(await api({ module: "block", action: "getblocknobytime", timestamp: endTs, closest: "after" }));
  const txs = await api({
    module: "account",
    action: "txlist",
    address,
    startblock: startBlock,
    endblock: endBlock,
    page: 1,
    offset: 10000,
    sort: "asc",
  });

  const matched = (txs || []).filter((tx) => {
    if ((tx.to || "").toLowerCase() !== address.toLowerCase()) return false;
    const ts = Number(tx.timeStamp);
    if (ts < startTs || ts > endTs) return false;
    const fn = (tx.functionName || "").trim();
    if (/^transfer$/i.test(fn) || /^transfer\s*\(/i.test(fn)) return true;
    return BigInt(tx.value || 0) > 0n && (!tx.input || tx.input === "0x") && !fn;
  });

  const text = JSON.stringify(matched, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert(`已复制 ${matched.length} 笔 Transfer 交易`);
  } catch {
    console.log(text);
    alert("JSON 已输出到 Console");
  }
  console.log({ startTs, endTs, count: matched.length, matched });
})();
