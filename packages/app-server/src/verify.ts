import { createHmac, timingSafeEqual } from 'crypto';

/**
 * 验证请求签名
 * @param payload 请求体
 * @param signature 请求头中的签名
 * @param secret 密钥
 * @returns 是否验证通过
 */
export function verifySignature(
  payload: unknown,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  // 移除 "sha256=" 前缀（如果存在）
  const signatureValue = signature.replace(/^sha256=/, '');

  const hmac = createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');

  try {
    // 使用时间安全的比较，防止时序攻击
    timingSafeEqual(Buffer.from(digest), Buffer.from(signatureValue));
    return true;
  } catch {
    return false;
  }
}
