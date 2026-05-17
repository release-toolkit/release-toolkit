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
    kid: String(now),
    exp: now + 60, // 60 秒过期
  };

  const joseHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // 使用 crypto.createSign 生成签名
  const base64Header = Buffer.from(JSON.stringify(joseHeader)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${base64Header}.${base64Payload}`);
  const signature = sign.sign(privateKeyPem, 'base64url');

  return `${base64Header}.${base64Payload}.${signature}`;
}

/**
 * 生成 GitHub App Installation Access Token
 */
export async function generateInstallationToken(
  jwt: string,
  installationId: number
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to generate installation token: ${response.status}`);
  }

  const data = await response.json() as { token: string };
  return data.token;
}
