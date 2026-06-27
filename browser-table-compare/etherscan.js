import { ethToWeiBigInt, weiBigIntToEth } from "./compare.js";

export const MAINNET_GENESIS_TIME = 1606824023;
export const SLOTS_PER_EPOCH = 32;
export const SECONDS_PER_SLOT = 12;
export const DEFAULT_EL_FEE_ADDRESS = "0xee5f5c53ce2159fc6dd4b0571e86a4a390d04846";

/** 主网 Epoch → Unix 时间（共识规范：genesis_time + slot×12s） */
export function epochRangeToUnix(startEpoch, endEpoch) {
  const start = Number(startEpoch);
  const end = Number(endEpoch);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new Error("Epoch 范围无效");
  }
  const startTs = MAINNET_GENESIS_TIME + start * SLOTS_PER_EPOCH * SECONDS_PER_SLOT;
  const endTs = MAINNET_GENESIS_TIME + (end + 1) * SLOTS_PER_EPOCH * SECONDS_PER_SLOT - 1;
  return { startEpoch: start, endEpoch: end, startTs, endTs };
}

export function formatUnixUtc(ts) {
  return new Date(ts * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

async function etherscanGet(params, apiKey) {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  if (apiKey) url.searchParams.set("apikey", apiKey);

  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "1" && json.message !== "OK") {
    const msg = typeof json.result === "string" ? json.result : json.message;
    throw new Error(msg || "Etherscan API 错误");
  }
  return json.result;
}

export async function getBlockByTime(timestamp, apiKey, closest = "before") {
  return Number(await etherscanGet(
    { module: "block", action: "getblocknobytime", timestamp, closest },
    apiKey
  ));
}

export async function fetchTxList(address, startBlock, endBlock, apiKey) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await etherscanGet(
      {
        module: "account",
        action: "txlist",
        address,
        startblock: startBlock,
        endblock: endBlock,
        page,
        offset: 1000,
        sort: "asc",
      },
      apiKey
    );
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  return all;
}

/** Etherscan Transactions 表中 Method 为 Transfer（含原生 ETH 转入） */
export function isTransferMethodTx(tx, address) {
  if ((tx.to || "").toLowerCase() !== address.toLowerCase()) return false;
  const fn = (tx.functionName || "").trim();
  if (/^transfer$/i.test(fn)) return true;
  if (/^transfer\s*\(/i.test(fn)) return true;
  const value = BigInt(tx.value || 0);
  if (value > 0n && (!tx.input || tx.input === "0x") && !fn) return true;
  return false;
}

export function filterTransferTxs(txs, address, startTs, endTs) {
  return txs.filter((tx) => {
    const ts = Number(tx.timeStamp);
    if (!Number.isFinite(ts) || ts < startTs || ts > endTs) return false;
    return isTransferMethodTx(tx, address);
  });
}

export function sumTxValuesWei(txs) {
  return txs.reduce((s, tx) => s + BigInt(tx.value || 0), 0n);
}

export async function fetchElTransfersFromEtherscan(address, startEpoch, endEpoch, apiKey) {
  if (!apiKey?.trim()) throw new Error("请填写 Etherscan API Key");
  const range = epochRangeToUnix(startEpoch, endEpoch);
  const startBlock = await getBlockByTime(range.startTs, apiKey, "before");
  const endBlock = await getBlockByTime(range.endTs, apiKey, "after");
  const txs = await fetchTxList(address, startBlock, endBlock, apiKey);
  const matched = filterTransferTxs(txs, address, range.startTs, range.endTs);
  const totalWei = sumTxValuesWei(matched);
  return {
    ...range,
    address,
    transactions: matched,
    totalWei,
    totalEth: weiBigIntToEth(totalWei),
    blockRange: { startBlock, endBlock },
  };
}

export function parseEtherscanTxPayload(raw) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Etherscan 数据为空");
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("请粘贴 Etherscan txlist JSON 数组，或 API 返回的 result");
  }
  const txs = Array.isArray(parsed) ? parsed : parsed?.result && Array.isArray(parsed.result) ? parsed.result : null;
  if (!txs) throw new Error("无法识别 Etherscan JSON 格式");
  return txs;
}

export function computeElFromManualTxs(raw, address, startEpoch, endEpoch) {
  const range = epochRangeToUnix(startEpoch, endEpoch);
  const txs = parseEtherscanTxPayload(raw);
  const matched = filterTransferTxs(txs, address, range.startTs, range.endTs);
  const totalWei = sumTxValuesWei(matched);
  return {
    ...range,
    address,
    transactions: matched,
    totalWei,
    totalEth: weiBigIntToEth(totalWei),
    blockRange: null,
  };
}

export function compareEl(csvElEth, etherscanTotalEth, validatorCount = 1) {
  const count = Number(validatorCount);
  if (!Number.isFinite(count) || count <= 0 || !Number.isInteger(count)) {
    throw new Error("CSV 该 Epoch 区间内无有效 Public Key，无法计算人均 EL");
  }
  const csvWei = ethToWeiBigInt(csvElEth);
  const totalWei = ethToWeiBigInt(etherscanTotalEth);
  const countBn = BigInt(count);
  const perValidatorWei = totalWei / countBn;
  const diffWei = csvWei - perValidatorWei;
  return {
    csvElEth,
    etherscanTotalEth,
    etherscanPerValidatorEth: weiBigIntToEth(perValidatorWei),
    validatorCount: count,
    diffEth: weiBigIntToEth(diffWei),
    elMatch: diffWei === 0n,
  };
}
