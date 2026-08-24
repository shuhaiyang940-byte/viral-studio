/**
 * 本地假 Neon HTTP 端点 —— 仅供开发自测，请勿用于生产。
 *
 * 它把 Neon 的 /sql 协议实现成一个「内存小库」：真的存 INSERT 进来的行，
 * 真的按 WHERE 过滤后返回，所以可以在没有 Postgres / Docker 的环境里
 * 把注册登录、收藏关注、种子导入这些依赖数据库的链路完整跑通。
 *
 * 支持的 SQL 子集（够本项目用，不追求通用）：
 *   - CREATE TABLE / INDEX（忽略）
 *   - INSERT ... VALUES ... [ON CONFLICT DO NOTHING] [RETURNING ...]
 *   - SELECT <cols> FROM <t> [JOIN ...] [WHERE ...] [ORDER BY ...] [LIMIT n OFFSET m]
 *   - UPDATE <t> SET col = $n [, ...] WHERE ...
 *   - DELETE FROM <t> WHERE ...
 *   - count(*)::int AS c
 * WHERE 支持 AND / OR / 括号，比较符 = 和 ILIKE，右值必须是 $n 占位符。
 *
 * 用法：
 *   node scripts/fake-neon.mjs 5555
 *   DATABASE_URL=postgresql://u:p@localhost/db \
 *   NEON_FETCH_ENDPOINT=http://127.0.0.1:5555/sql \
 *   JWT_SECRET=dev-secret SEED_TOKEN=testseed npm run start -- -p 3100
 *   # 预置账号 demo@viral.studio / 123456
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

const PORT = Number(process.argv[2] || 5555);
const VERBOSE = process.env.FAKE_NEON_VERBOSE === "1";

// ── 表结构（列名 + pg 类型 OID，Neon 需要 fields 才能正确解析）─────────
const T = { text: 25, int4: 23, float8: 701, bool: 16, jsonb: 3802, ts: 1184 };

const SCHEMA = {
  users: [
    ["id", T.text], ["email", T.text], ["name", T.text], ["password_hash", T.text],
    ["tier", T.text], ["phone", T.text], ["email_verified", T.bool], ["created_at", T.ts],
  ],
  cases: [
    ["id", T.text], ["title", T.text], ["category", T.text], ["cover", T.text],
    ["views", T.int4], ["score", T.int4], ["summary", T.text], ["tags", T.jsonb],
    ["is_seed", T.bool], ["created_by", T.text], ["created_at", T.ts],
  ],
  benchmarks: [
    ["id", T.text], ["name", T.text], ["handle", T.text], ["platform", T.text],
    ["idea_type", T.text], ["styles", T.jsonb], ["effects", T.jsonb], ["face", T.bool],
    ["product_type", T.text], ["followers", T.int4], ["engagement_rate", T.float8],
    ["reason", T.text], ["sample_title", T.text], ["is_seed", T.bool],
    ["created_by", T.text], ["created_at", T.ts],
  ],
  case_saves: [["user_id", T.text], ["case_id", T.text], ["created_at", T.ts]],
  benchmark_tracks: [["user_id", T.text], ["benchmark_id", T.text], ["created_at", T.ts]],
  email_tokens: [
    ["token_hash", T.text], ["user_id", T.text], ["type", T.text],
    ["expires_at", T.ts], ["used_at", T.ts], ["created_at", T.ts],
  ],
  ip_blocklist: [
    ["ip", T.text], ["reason", T.text], ["expires_at", T.ts], ["created_at", T.ts],
  ],
  rate_limits: [["key", T.text], ["count", T.int4], ["window_start", T.int4]],
  kv_store: [["key", T.text], ["value", T.jsonb], ["updated_at", T.ts]],
  quota_usage: [["key", T.text], ["count", T.int4], ["day", T.text]],
};

const TYPE_OF = {};
for (const [t, cols] of Object.entries(SCHEMA)) {
  TYPE_OF[t] = Object.fromEntries(cols);
}

/** 每张表一个数组，行是 { 列名: JS 值 } */
const db = Object.fromEntries(Object.keys(SCHEMA).map((t) => [t, []]));

const NOW = () => new Date().toISOString().replace("T", " ").replace("Z", "+00");

// 预置一个测试账号
db.users.push({
  id: "u_demo_0001",
  email: "demo@viral.studio",
  name: "演示用户",
  password_hash: bcrypt.hashSync("123456", 10),
  tier: "free",
  phone: null,
  created_at: NOW(),
});

const seen = [];

// ── WHERE 求值：col [::text] (= | ILIKE) $n，支持 AND / OR / 括号 ────────
function tokenize(src) {
  const re = /\(|\)|\bAND\b|\bOR\b|\$\d+|ILIKE|=|[a-zA-Z_][\w.]*(?:::\w+)?|'[^']*'|\S/gi;
  return src.match(re) ?? [];
}

function makeWhere(clause, params) {
  // now() 在 WHERE 里直接替换成当前 ISO 时间字符串（无空格，方便 tokenize 与比较）
  clause = clause.replace(/\bnow\(\)/gi, "'" + new Date().toISOString() + "'");
  const toks = tokenize(clause);
  let i = 0;
  const peek = () => toks[i];
  const eat = () => toks[i++];

  function atom() {
    if (peek() === "(") {
      eat();
      const fn = orExpr();
      if (peek() === ")") eat();
      return fn;
    }
    const rawCol = eat() ?? "";
    const col = rawCol.split("::")[0].split(".").pop();
    const op = (eat() ?? "=").toUpperCase();
    const rhs = eat() ?? "";
    const idx = rhs.startsWith("$") ? Number(rhs.slice(1)) - 1 : -1;
    const literal = rhs.startsWith("'") ? rhs.slice(1, -1) : null;
    return (row) => {
      const v = row[col];
      const target = idx >= 0 ? params[idx] : literal;
      if (op === "IS") return v == null;
      if (op === "ILIKE") {
        const hay = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
        const pat = String(target ?? "");
        // 把 SQL 的 % 通配转成正则
        const rx = new RegExp(
          "^" + pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$",
          "i"
        );
        return rx.test(hay);
      }
      if (target === null || target === undefined) return v === null || v === undefined;
      // 数值 / 时间戳比较（> < >= <=）：优先按数字比，时间字符串归一化后按时间戳比
      if (op === ">" || op === "<" || op === ">=" || op === "<=") {
        const num = (x) => {
          const n = Number(x);
          if (!Number.isNaN(n)) return n;
          const t = Date.parse(String(x).replace(" ", "T"));
          return Number.isNaN(t) ? Number.NaN : t;
        };
        const a = num(v);
        const b = num(target);
        if (!Number.isNaN(a) && !Number.isNaN(b)) {
          if (op === ">") return a > b;
          if (op === "<") return a < b;
          if (op === ">=") return a >= b;
          return a <= b;
        }
      }
      // 参数化查询里数字/布尔都可能以字符串过来，统一按字符串比
      return String(v) === String(target);
    };
  }

  function andExpr() {
    let fn = atom();
    while (peek() && peek().toUpperCase() === "AND") {
      eat();
      const rhs = atom();
      const lhs = fn;
      fn = (row) => lhs(row) && rhs(row);
    }
    return fn;
  }

  function orExpr() {
    let fn = andExpr();
    while (peek() && peek().toUpperCase() === "OR") {
      eat();
      const rhs = andExpr();
      const lhs = fn;
      fn = (row) => lhs(row) || rhs(row);
    }
    return fn;
  }

  return orExpr();
}

// ── 值序列化：Neon 的 raw-text 模式要求所有值是字符串或 null ────────────
function toWire(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "t" : "f";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function fieldsOf(table, cols) {
  const types = TYPE_OF[table] ?? {};
  return cols.map((name) => ({ name, dataTypeID: types[name] ?? T.text }));
}

function result(command, table, cols, rows) {
  return {
    command,
    fields: fieldsOf(table, cols),
    rows: rows.map((r) => cols.map((c) => toWire(r[c]))),
    rowCount: rows.length,
  };
}

const EMPTY = { command: "OK", fields: [], rows: [], rowCount: 0 };

// ── 语句分发 ────────────────────────────────────────────────────────
function route(query, params = []) {
  const q = String(query).trim().replace(/\s+/g, " ");
  seen.push({ q, params });
  if (VERBOSE) {
    console.log(`\n  SQL » ${q}`);
    if (params?.length) console.log(`  参数 » ${JSON.stringify(params)}`);
  }

  if (/^CREATE\s+(TABLE|INDEX|UNIQUE)/i.test(q)) return EMPTY;

  // INSERT INTO t (a, b, c) VALUES ($1, $2, $3) [ON CONFLICT ...] [RETURNING ...]
  let m = q.match(/^INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]*)\)(.*)$/i);
  if (m) {
    const [, table, colList, valList, tail] = m;
    if (!db[table]) return EMPTY;
    const cols = colList.split(",").map((s) => s.trim());
    const vals = valList.split(",").map((s) => s.trim());
    const row = {};
    cols.forEach((c, k) => {
      const v = vals[k];
      if (v === undefined) row[c] = null;
      else if (/^\$\d+$/.test(v)) row[c] = params[Number(v.slice(1)) - 1] ?? null;
      else if (/^'/.test(v)) row[c] = v.slice(1, -1);
      else if (/^(true|false)$/i.test(v)) row[c] = /^true$/i.test(v);
      else if (/^NULL$/i.test(v)) row[c] = null;
      else if (/^(now\(\)|CURRENT_TIMESTAMP)$/i.test(v)) row[c] = NOW();
      else row[c] = v;
    });
    for (const [c] of SCHEMA[table]) {
      if (c in row) continue;
      if (c === "created_at") row[c] = NOW();
      else if (c === "tier") row[c] = "free";
      else if (c === "email_verified") row[c] = false;
      else row[c] = null;
    }

    // 主键/联合唯一冲突检测（ON CONFLICT DO NOTHING 时静默跳过；DO UPDATE 时执行更新）
    const keys = table === "case_saves"
      ? ["user_id", "case_id"]
      : table === "benchmark_tracks"
      ? ["user_id", "benchmark_id"]
      : SCHEMA[table].some(([c]) => c === "id")
        ? ["id"]
        : [SCHEMA[table][0][0]];
    const dup = db[table].find((r) => keys.every((k) => String(r[k]) === String(row[k])));
    const emailDup = table === "users" && db.users.find((r) => r.email === row.email);
    if (dup && /ON CONFLICT.*DO UPDATE/i.test(tail)) {
      // UPSERT：rate_limits 需要「同窗口 +1 / 跨窗口重置」语义；其余表用新值覆盖
      if (table === "rate_limits") {
        if (Number(dup.window_start) === Number(row.window_start)) {
          dup.count = (Number(dup.count) || 0) + 1;
        } else {
          dup.count = 1;
          dup.window_start = row.window_start;
        }
      } else if (table === "quota_usage") {
        if (dup.day === row.day) {
          dup.count = (Number(dup.count) || 0) + 1;
        } else {
          dup.count = 1;
          dup.day = row.day;
        }
      } else {
        Object.assign(dup, row);
      }
      const ret = tail.match(/RETURNING\s+(.+?)(?:;|$)/i);
      if (ret) {
        const rc = ret[1]
          .split(",")
          .map((s) => s.trim().split(/\s+as\s+/i)[0].trim())
          .flatMap((c) => (c === "*" || /\w+\.\*$/.test(c)) ? SCHEMA[table].map(([col]) => col) : [c]);
        return result("INSERT", table, rc, [dup]);
      }
      return { ...EMPTY, command: "INSERT", rowCount: 1 };
    }
    if (dup || emailDup) {
      if (/ON CONFLICT/i.test(tail)) return EMPTY;
      const err = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      throw err;
    }
    db[table].push(row);

    const ret = tail.match(/RETURNING\s+(.+?)(?:;|$)/i);
    if (ret) {
      const rc = ret[1]
        .split(",")
        .map((s) => s.trim().split(/\s+as\s+/i)[0].trim())
        // 展开 RETURNING * / t.* 为全部列名（否则 result() 会去取 r["*"] 得到 undefined）
        .flatMap((c) => (c === "*" || /\w+\.\*$/.test(c)) ? SCHEMA[table].map(([col]) => col) : [c]);
      return result("INSERT", table, rc, [row]);
    }
    return { ...EMPTY, command: "INSERT", rowCount: 1 };
  }

  // SELECT count(*)::int AS c FROM t [WHERE ...]
  m = q.match(/^SELECT count\(\*\)(?:::int)?\s+AS\s+(\w+) FROM (\w+)(?: \w+)?(?: WHERE (.+?))?$/i);
  if (m) {
    const [, alias, table, where] = m;
    const rows = db[table] ?? [];
    const n = where ? rows.filter(makeWhere(where, params)).length : rows.length;
    return {
      command: "SELECT",
      fields: [{ name: alias, dataTypeID: T.int4 }],
      rows: [[String(n)]],
      rowCount: 1,
    };
  }

  // SELECT <cols> FROM <t> [alias] [JOIN <t2> alias ON ...] [WHERE] [ORDER BY] [LIMIT] [OFFSET]
  m = q.match(/^SELECT (.+?) FROM (\w+)(?:\s+(?!WHERE|JOIN|ORDER|LIMIT|OFFSET)(\w+))?(.*)$/i);
  if (m && /^SELECT/i.test(q)) {
    const [, colSpec, table, , rest] = m;
    if (!db[table]) return EMPTY;
    let rows = db[table].slice();

    // JOIN：本项目只有「主表 JOIN 关联表 ON 关联表.xx = 主表.id」这一种形态
    const join = rest.match(/JOIN (\w+) (\w+) ON \S+ = \S+/i);
    if (join) {
      const jt = join[1];
      const linkCol = jt === "case_saves" ? "case_id" : "benchmark_id";
      const whereM = rest.match(/WHERE (.+?)(?: ORDER BY | LIMIT | OFFSET |$)/i);
      const jrows = whereM
        ? (db[jt] ?? []).filter(makeWhere(whereM[1], params))
        : db[jt] ?? [];
      const ids = new Set(jrows.map((r) => String(r[linkCol])));
      rows = rows.filter((r) => ids.has(String(r.id)));
    } else {
      const whereM = rest.match(/WHERE (.+?)(?: ORDER BY | LIMIT | OFFSET |$)/i);
      if (whereM) rows = rows.filter(makeWhere(whereM[1], params));
    }

    const orderM = rest.match(/ORDER BY ([\w.]+)(?:::\w+)?\s*(ASC|DESC)?/i);
    if (orderM) {
      const col = orderM[1].split(".").pop();
      const dir = (orderM[2] || "ASC").toUpperCase() === "DESC" ? -1 : 1;
      rows.sort((a, b) => {
        const x = a[col], y = b[col];
        const nx = Number(x), ny = Number(y);
        if (!Number.isNaN(nx) && !Number.isNaN(ny)) return (nx - ny) * dir;
        return String(x ?? "").localeCompare(String(y ?? "")) * dir;
      });
    }

    const offM = rest.match(/OFFSET (\$?\d+)/i);
    const limM = rest.match(/LIMIT (\$?\d+)/i);
    const num = (tok) => (tok.startsWith("$") ? Number(params[Number(tok.slice(1)) - 1]) : Number(tok));
    if (offM) rows = rows.slice(num(offM[1]));
    if (limM) rows = rows.slice(0, num(limM[1]));

    const spec = colSpec.trim();
    const cols =
      spec === "*" || /^\w+\.\*$/.test(spec)
        ? SCHEMA[table].map(([c]) => c)
        : spec.split(",").map((s) => s.trim().split(/\s+as\s+/i)[0].split(".").pop().trim());
    return result("SELECT", table, cols, rows);
  }

  // UPDATE t SET a = $1, b = $2 [WHERE ...] [RETURNING ...]
  const upRet = q.match(/RETURNING\s+(.+?)(?:;|$)/i);
  const upBase = upRet ? q.replace(/RETURNING\s+.+?(?:;|$)/i, "") : q;
  m = upBase.match(/^UPDATE (\w+) SET (.+?)(?: WHERE (.+?))?$/i);
  if (m) {
    const [, table, setList, where] = m;
    if (!db[table]) return EMPTY;
    const targets = where ? db[table].filter(makeWhere(where, params)) : db[table];
    for (const row of targets) {
      for (const pair of setList.split(/,(?![^(]*\))/)) {
        const [c, v] = pair.split("=").map((s) => s.trim());
        row[c] = /^\$\d+$/.test(v) ? params[Number(v.slice(1)) - 1] ?? null : v.replace(/^'|'$/g, "");
      }
    }
    if (upRet) {
      const rc = upRet[1]
        .split(",")
        .map((s) => s.trim().split(/\s+as\s+/i)[0].trim())
        .flatMap((c) => (c === "*" || /\w+\.\*$/.test(c)) ? SCHEMA[table].map(([col]) => col) : [c]);
      return result("UPDATE", table, rc, targets);
    }
    return { ...EMPTY, command: "UPDATE", rowCount: targets.length };
  }

  // DELETE FROM t WHERE ...
  m = q.match(/^DELETE FROM (\w+)(?: WHERE (.+?))?$/i);
  if (m) {
    const [, table, where] = m;
    if (!db[table]) return EMPTY;
    const before = db[table].length;
    if (where) {
      const pred = makeWhere(where, params);
      db[table] = db[table].filter((r) => !pred(r));
    } else {
      db[table] = [];
    }
    return { ...EMPTY, command: "DELETE", rowCount: before - db[table].length };
  }

  console.log(`  ⚠️  未识别的 SQL，返回空结果：${q.slice(0, 120)}`);
  return EMPTY;
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__seen") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(seen, null, 2));
    return;
  }
  if (req.method === "GET" && req.url === "/__db") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        Object.fromEntries(Object.entries(db).map(([t, r]) => [t, r.length])),
        null,
        2
      )
    );
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400).end('{"message":"bad json"}');
      return;
    }
    try {
      let out;
      if (Array.isArray(payload.queries)) {
        if (VERBOSE) console.log(`\n=== 事务批量：${payload.queries.length} 条 ===`);
        out = { results: payload.queries.map((x) => route(x.query, x.params)) };
      } else {
        out = route(payload.query, payload.params);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(out));
    } catch (e) {
      // 把唯一约束冲突等错误按 Neon 的错误格式回传，让上层能正确处理
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: e.message, code: e.code || "XX000" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`假 Neon 端点已启动: http://127.0.0.1:${PORT}/sql`);
  console.log(`测试账号: demo@viral.studio / 123456`);
  console.log(`查看表行数: http://127.0.0.1:${PORT}/__db   查看收到的 SQL: /__seen`);
});
