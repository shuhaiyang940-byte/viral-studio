// 支付订单存取：真实下单/回调的落库层。
// 幂等建表：ensureSchema 用「users 已存在」探测会跳过新表，故这里独立建 billing_orders。

import { getSql, hasDatabase } from "@/lib/db";
import type { Tier } from "./config";

export interface BillingOrder {
  orderId: string;
  userId: string;
  tier: Tier;
  amount: number;
  provider: "wechat" | "alipay";
  status: "pending" | "paid" | "expired" | "failed";
  outTradeNo?: string;
  createdAt: string;
  paidAt?: string | null;
}

let _ordersReady: Promise<void> | null = null;

export function ensureOrdersSchema(): Promise<void> {
  if (!hasDatabase()) return Promise.resolve();
  if (!_ordersReady) {
    _ordersReady = (async () => {
      const sql = getSql();
      await sql.query(`
        CREATE TABLE IF NOT EXISTS billing_orders (
          order_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          tier TEXT NOT NULL,
          amount INTEGER NOT NULL DEFAULT 0,
          provider TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          out_trade_no TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          paid_at TIMESTAMPTZ
        )
      `);
    })().catch((e) => {
      _ordersReady = null;
      throw e;
    });
  }
  return _ordersReady;
}

export async function createBillingOrder(input: {
  orderId: string;
  userId: string;
  tier: Exclude<Tier, "free">;
  amount: number;
  provider: "wechat" | "alipay";
  outTradeNo?: string;
}): Promise<void> {
  await ensureOrdersSchema();
  const sql = getSql();
  await sql.query(
    `INSERT INTO billing_orders (order_id, user_id, tier, amount, provider, status, out_trade_no)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)
     ON CONFLICT (order_id) DO NOTHING`,
    [input.orderId, input.userId, input.tier, input.amount, input.provider, input.outTradeNo ?? null]
  );
}

export async function markOrderPaid(orderId: string): Promise<boolean> {
  await ensureOrdersSchema();
  const sql = getSql();
  const rows = await sql.query(
    `UPDATE billing_orders SET status = 'paid', paid_at = now() WHERE order_id = $1 AND status = 'pending' RETURNING user_id, tier`,
    [orderId]
  );
  return rows.length > 0 && rows[0].user_id != null;
}

export async function getOrder(orderId: string): Promise<BillingOrder | null> {
  await ensureOrdersSchema();
  const sql = getSql();
  const rows = await sql.query(`SELECT * FROM billing_orders WHERE order_id = $1`, [orderId]);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    orderId: r.order_id,
    userId: r.user_id,
    tier: r.tier,
    amount: Number(r.amount),
    provider: r.provider,
    status: r.status,
    outTradeNo: r.out_trade_no,
    createdAt: r.created_at,
    paidAt: r.paid_at,
  };
}
