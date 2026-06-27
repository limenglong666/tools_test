const GWEI = 1_000_000_000n;
const WEI = 1_000_000_000_000_000_000n;

const CL_FIELDS_REWARD = [
  "attestation_head_reward",
  "attestation_source_reward",
  "attestation_target_reward",
  "proposer_attestation_inclusion_reward",
  "proposer_slashing_inclusion_reward",
  "proposer_sync_inclusion_reward",
  "sync_committee_reward",
  "slashing_reward",
];

const CL_FIELDS_PENALTY = [
  "attestation_source_penalty",
  "attestation_target_penalty",
  "sync_committee_penalty",
  "slashing_penalty",
  "finality_delay_penalty",
];

export function normalizePubkey(pk) {
  if (!pk) return "";
  let s = String(pk).trim().toLowerCase();
  if (!s.startsWith("0x")) s = "0x" + s;
  return s;
}

export function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (!lines.length) throw new Error("CSV 为空");

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = {
    publicKey: findCol(header, ["Public Key", "public key", "pubkey"]),
    cl: findCol(header, ["CL Rewards Generated", "CL Rewards", "CL Reward"]),
    el: findCol(header, ["EL Rewards Generated", "EL Rewards", "EL Reward"]),
    validatorIndex: findCol(header, ["Validator Index ID", "Validator Index", "validator_index"]),
    date: findCol(header, ["Date", "date"]),
    epochRange: findCol(header, ["Epoch Range", "epoch range", "Epoch range"]),
  };
  if (idx.publicKey < 0) throw new Error("未找到 Public Key 列");
  if (idx.cl < 0) throw new Error("未找到 CL Rewards Generated 列");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (!cols.length) continue;
    const publicKey = normalizePubkey(cols[idx.publicKey]);
    if (!publicKey) continue;
    const epochRangeRaw = idx.epochRange >= 0 ? cols[idx.epochRange]?.trim() : "";
    const epochParsed = parseEpochRange(epochRangeRaw);
    rows.push({
      line: i + 1,
      date: idx.date >= 0 ? cols[idx.date]?.trim() : "",
      publicKey,
      validatorIndex: idx.validatorIndex >= 0 ? cols[idx.validatorIndex]?.trim() : "",
      clEth: parseFloat(cols[idx.cl]) || 0,
      elEth: idx.el >= 0 ? parseFloat(cols[idx.el]) || 0 : 0,
      epochRange: epochRangeRaw,
      epochStart: epochParsed?.start ?? null,
      epochEnd: epochParsed?.end ?? null,
    });
  }
  return { header, rows };
}

function findCol(header, names) {
  const lower = header.map((h) => h.toLowerCase());
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** 解析 CSV Epoch Range，如 457380-457394、457380 – 457394、457380 */
export function parseEpochRange(text) {
  if (text == null || !String(text).trim()) return null;
  const s = String(text).trim();

  const rangeMatch = s.match(/(\d+)\s*(?:[-–—~]|to)\s*(\d+)/i);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1], 10);
    const b = parseInt(rangeMatch[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { start: Math.min(a, b), end: Math.max(a, b), raw: s };
    }
  }

  const single = s.match(/^(\d+)$/);
  if (single) {
    const n = parseInt(single[1], 10);
    return { start: n, end: n, raw: s };
  }

  return null;
}

export function aggregateCsvByPubkey(rows, pubkey) {
  const pk = normalizePubkey(pubkey);
  const matched = rows.filter((r) => r.publicKey === pk);
  if (!matched.length) {
    return { publicKey: pk, rows: [], clEth: 0, elEth: 0 };
  }
  return {
    publicKey: pk,
    validatorIndex: matched[0].validatorIndex,
    rows: matched,
    clEth: matched.reduce((s, r) => s + r.clEth, 0),
    elEth: matched.reduce((s, r) => s + r.elEth, 0),
  };
}

export function csvAggFromRow(row) {
  if (!row) return { rows: [], clEth: 0, elEth: 0 };
  return {
    publicKey: row.publicKey,
    validatorIndex: row.validatorIndex,
    rows: [row],
    clEth: row.clEth,
    elEth: row.elEth,
  };
}

/** CSV 中与 [startEpoch, endEpoch] 有交集的行里，唯一 Public Key 数量 */
export function countUniquePubkeysInCsvEpochRange(rows, startEpoch, endEpoch) {
  const start = Number(startEpoch);
  const end = Number(endEpoch);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new Error("Epoch 范围无效");
  }
  const pubkeys = new Set();
  for (const row of rows) {
    if (row.epochStart == null || row.epochEnd == null) continue;
    if (row.epochStart <= end && row.epochEnd >= start) {
      pubkeys.add(row.publicKey);
    }
  }
  return pubkeys.size;
}

export function listValidatorsFromCsv(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.publicKey)) {
      map.set(r.publicKey, {
        publicKey: r.publicKey,
        validatorIndex: r.validatorIndex || "",
        rowCount: 0,
        clEth: 0,
      });
    }
    const v = map.get(r.publicKey);
    v.rowCount += 1;
    v.clEth += r.clEth;
    if (r.validatorIndex) v.validatorIndex = r.validatorIndex;
  }
  return [...map.values()].sort((a, b) => {
    const ia = parseInt(a.validatorIndex, 10) || 0;
    const ib = parseInt(b.validatorIndex, 10) || 0;
    if (ia !== ib) return ia - ib;
    return a.publicKey.localeCompare(b.publicKey);
  });
}

export function truncatePubkey(pk, head = 10, tail = 6) {
  if (!pk || pk.length <= head + tail + 3) return pk;
  return pk.slice(0, head + 2) + "…" + pk.slice(-tail);
}

export function ethToGweiBigInt(eth) {
  const s = eth.toFixed(18);
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "000000000").slice(0, 9);
  return BigInt(whole || "0") * GWEI + BigInt(padded);
}

export function ethToWeiBigInt(eth) {
  const s = eth.toFixed(18);
  const [whole, frac = ""] = s.split(".");
  const padded = (frac + "000000000000000000").slice(0, 18);
  return BigInt(whole || "0") * WEI + BigInt(padded);
}

export function gweiBigIntToEth(gwei) {
  const neg = gwei < 0n;
  const v = neg ? -gwei : gwei;
  const whole = v / GWEI;
  const frac = v % GWEI;
  const eth = Number(whole) + Number(frac) / Number(GWEI);
  return neg ? -eth : eth;
}

export function weiBigIntToEth(wei) {
  const whole = wei / WEI;
  const frac = wei % WEI;
  return Number(whole) + Number(frac) / Number(WEI);
}

export function clIncomeGwei(income) {
  if (!income) return 0n;
  const n = (k) => BigInt(income[k] ?? 0);
  let total = 0n;
  for (const f of CL_FIELDS_REWARD) total += n(f);
  for (const f of CL_FIELDS_PENALTY) total -= n(f);
  return total;
}

export function parseBeaconchaPayload(raw) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("beaconcha 数据为空");

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    if (looksLikeManualEpochLines(trimmed)) {
      return parseManualEpochEntries(trimmed);
    }
    parsed = parseHtmlTable(trimmed);
  }

  let items = [];
  if (Array.isArray(parsed)) items = parsed;
  else if (parsed?.data && Array.isArray(parsed.data)) items = parsed.data;
  else if (parsed?.status === "OK" && Array.isArray(parsed.data)) items = parsed.data;
  else throw new Error("无法识别 beaconcha 数据格式，请粘贴 API JSON、手动 Epoch 行或页面表格 HTML");

  return items.map(normalizeBeaconchaRow).filter(Boolean);
}

function looksLikeManualEpochLines(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith("#"));
  if (!line) return false;
  if (/\d+\s*GWei/i.test(line)) return true;
  return /^\s*\d{5,}\s*[,\s|\t]/.test(line);
}

/**
 * 手动粘贴每行一条，支持：
 * - beaconcha 复制：457448	+8609 GWei
 * - 通用：Epoch CL_ETH（ETH 小数）
 */
export function parseManualEpochEntries(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const map = new Map();
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) continue;

    const row = parseManualEpochLine(raw, i + 1);
    if (row.error) {
      errors.push(row.error);
      continue;
    }
    map.set(row.epoch, row);
  }

  if (errors.length) throw new Error(errors.join("\n"));
  if (!map.size) throw new Error("未解析到任何 Epoch 数据，请粘贴 beaconcha 行（如 457448 +8609 GWei）或 Epoch CL_ETH");

  return [...map.values()].sort((a, b) => a.epoch - b.epoch);
}

function parseManualEpochLine(line, lineNo) {
  const epochLead = line.match(/^\s*(\d+)\b/);
  if (!epochLead) {
    return { error: `第 ${lineNo} 行 Epoch 无效：${line}` };
  }
  const epoch = parseInt(epochLead[1], 10);

  const gweiMatch = line.match(/([+-]?\d+)\s*GWei\b/i);
  if (gweiMatch) {
    const clGwei = BigInt(gweiMatch[1]);
    return {
      epoch,
      clGwei,
      clEth: gweiBigIntToEth(clGwei),
    };
  }

  const cleaned = line.replace(/ETH/gi, "").trim();
  const parts = cleaned.split(/[\s,\t|]+/).filter(Boolean);

  if (parts.length < 2) {
    return { error: `第 ${lineNo} 行至少需要 Epoch 与 CL：${line}` };
  }

  const nums = parts.slice(1).map((p) => parseFloat(p.replace(/[^\d.eE+-]/g, ""))).filter((n) => !Number.isNaN(n));
  if (!nums.length) {
    return { error: `第 ${lineNo} 行缺少 CL 数值：${line}` };
  }

  const clEth = nums[0] ?? 0;

  return {
    epoch,
    clEth,
    clGwei: ethToGweiBigInt(clEth),
  };
}

export function summarizeManualEntries(text) {
  if (!text.trim()) return null;
  try {
    const rows = parseManualEpochEntries(text);
    const clGwei = rows.reduce((s, r) => s + (r.clGwei ?? 0n), 0n);
    const clEth = gweiBigIntToEth(clGwei);
    const epochs = rows.map((r) => r.epoch);
    return {
      count: rows.length,
      clEth,
      clGwei,
      epochMin: Math.min(...epochs),
      epochMax: Math.max(...epochs),
    };
  } catch (err) {
    return { error: err.message };
  }
}

export function resolveBeaconchaRows({ jsonText = "", manualText = "", preferManual = false } = {}) {
  const json = jsonText.trim();
  const manual = manualText.trim();
  if (!json && !manual) throw new Error("请粘贴 beaconcha 数据，或在手动模式下输入各 Epoch 结果");

  if (preferManual && manual) return parseManualEpochEntries(manual);
  if (manual && !json) return parseManualEpochEntries(manual);
  if (json && !manual) return parseBeaconchaPayload(json);
  if (preferManual) return parseManualEpochEntries(manual);
  return parseBeaconchaPayload(json);
}

function normalizeBeaconchaRow(row) {
  if (!row || row.epoch == null) return null;
  const income = row.income || row;
  const clGwei = row.cl_gwei != null ? BigInt(row.cl_gwei) : clIncomeGwei(income);
  const elWei =
    row.el_wei != null
      ? BigInt(row.el_wei)
      : BigInt(income.tx_fee_reward_wei ?? row.tx_fee_reward_wei ?? 0);
  return {
    epoch: Number(row.epoch),
    validatorIndex: row.validatorindex ?? row.validator_index ?? null,
    clGwei,
    elWei,
    clEth: gweiBigIntToEth(clGwei),
    elEth: weiBigIntToEth(elWei),
    raw: row,
  };
}

function parseHtmlTable(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) throw new Error("HTML 中未找到 table");
  const headers = [...table.querySelectorAll("thead th, tr:first-child th, tr:first-child td")].map((el) =>
    el.textContent.trim().toLowerCase()
  );
  const epochIdx = headers.findIndex((h) => h.includes("epoch"));
  if (epochIdx < 0) throw new Error("表格中未找到 Epoch 列");

  const clIdx = headers.findIndex((h) => h.includes("cl") || h.includes("consensus"));
  const elIdx = headers.findIndex((h) => h.includes("el") || h.includes("execution") || h.includes("fee"));

  const bodyRows = [...table.querySelectorAll("tbody tr")];
  const rows = bodyRows.length ? bodyRows : [...table.querySelectorAll("tr")].slice(1);
  return rows
    .map((tr) => {
      const cells = [...tr.querySelectorAll("td")].map((td) => td.textContent.trim());
      if (!cells.length) return null;
      const epoch = parseInt(cells[epochIdx], 10);
      if (!Number.isFinite(epoch)) return null;
      const out = { epoch };
      if (clIdx >= 0) out.cl_eth = parseFloat(cells[clIdx].replace(/[^\d.-]/g, "")) || 0;
      if (elIdx >= 0) out.el_eth = parseFloat(cells[elIdx].replace(/[^\d.-]/g, "")) || 0;
      if (out.cl_eth != null) out.cl_gwei = ethToGweiBigInt(out.cl_eth);
      if (out.el_eth != null) out.el_wei = ethToWeiBigInt(out.el_eth);
      return out;
    })
    .filter(Boolean);
}

export function filterEpochRange(rows, startEpoch, endEpoch) {
  const start = Number(startEpoch);
  const end = Number(endEpoch);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("Epoch 范围无效");
  if (start > end) throw new Error("起始 Epoch 不能大于结束 Epoch");
  const map = new Map();
  for (const row of rows) {
    if (row.epoch >= start && row.epoch <= end) {
      map.set(row.epoch, row);
    }
  }
  const epochs = [];
  for (let e = start; e <= end; e++) {
    epochs.push(map.get(e) || { epoch: e, clGwei: 0n, elWei: 0n, clEth: 0, elEth: 0, missing: true });
  }
  return epochs;
}

export function compareRewards(csvAgg, epochRows) {
  const beaconClGwei = epochRows.reduce((s, r) => s + (r.clGwei ?? 0n), 0n);
  const csvClGwei = ethToGweiBigInt(csvAgg.clEth);
  const clDiffGwei = csvClGwei - beaconClGwei;

  return {
    csv: {
      clEth: csvAgg.clEth,
      elEth: csvAgg.elEth ?? 0,
      clGwei: csvClGwei,
      rowCount: csvAgg.rows.length,
    },
    beaconcha: {
      clEth: gweiBigIntToEth(beaconClGwei),
      clGwei: beaconClGwei,
      epochCount: epochRows.filter((r) => !r.missing).length,
      missingEpochs: epochRows.filter((r) => r.missing).map((r) => r.epoch),
    },
    diff: {
      clEth: gweiBigIntToEth(clDiffGwei),
      clGwei: clDiffGwei,
      clMatch: clDiffGwei === 0n,
    },
    perEpoch: epochRows.map((r) => ({
      epoch: r.epoch,
      clEth: r.clEth ?? gweiBigIntToEth(r.clGwei ?? 0n),
      missing: !!r.missing,
    })),
  };
}

export function formatEth(n, digits = 12) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits).replace(/\.?0+$/, "") || "0";
}

export function formatDiff(n) {
  const sign = n > 0 ? "+" : "";
  return sign + formatEth(n, 12);
}
