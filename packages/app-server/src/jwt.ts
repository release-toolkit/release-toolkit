import { createSign } from 'node:crypto';

/**
 * 生成 GitHub App JWT
 * @param appId - GitHub App ID
 * @param privateKeyPem - 私钥 PEM 内容（通过环境变量传入）
 */
export async function generateJWT(
  appId: number,
  privateKeyPem: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: String(appId),
    exp: now + 600, // 10 分钟过期（GitHub 推荐）
  };

  const joseHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const base64Header = Buffer.from(JSON.stringify(joseHeader)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${base64Header}.${base64Payload}`);
  const signature = sign.sign(privateKeyPem, 'base64url');

  return `${base64Header}.${base64Payload}.${signature}`;
}
