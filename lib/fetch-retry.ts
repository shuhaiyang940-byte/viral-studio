// 客户端 fetch 重试：用于登录/生成/复盘等调用。
// 只对「网络错误（fetch reject）」和「服务端 5xx（冷启动/抖动）」重试；
// 业务错误（4xx，如配额/参数校验）直接返回，由调用方读取 error。

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  retries = 2
): Promise<Response> {
  let lastErr: unknown = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(input, init);
      if (res.status >= 500 && i < retries) {
        lastErr = new Error(`服务端 ${res.status}`);
        await sleep(800 * (i + 1));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await sleep(800 * (i + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
