import { SignJWT, importPKCS8 } from 'jose'

const TOKEN_TTL_SECONDS = 60 * 15

type TokenRequest = {
  userId: string
  shareToken?: string | null
}

type TokenResponse = {
  endpoint: string
  token: string
  expiresAt: string
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env variable: ${name}`)
  }

  return value
}

function getOptionalEnv(name: string): string | null {
  const value = process.env[name]
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function issuePowerSyncToken(request: TokenRequest): Promise<TokenResponse> {
  const powersyncUrl = getRequiredEnv('POWERSYNC_URL')

  // Dev-mode shortcut: use a PowerSync-generated development token directly.
  const developmentToken = getOptionalEnv('POWERSYNC_DEV_TOKEN')
  if (developmentToken) {
    return {
      endpoint: powersyncUrl,
      token: developmentToken,
      expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
    }
  }

  const privateKeyPem = getRequiredEnv('POWERSYNC_PRIVATE_KEY')

  const privateKey = await importPKCS8(privateKeyPem, 'RS256')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000)

  // PowerSync integration point: JWT claims define sync visibility scope.
  const token = await new SignJWT({
    sub: request.userId,
    share_token: request.shareToken ?? null,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer('relay-app')
    .setAudience('powersync')
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(privateKey)

  return {
    endpoint: powersyncUrl,
    token,
    expiresAt: expiresAt.toISOString(),
  }
}

export async function powersyncTokenHandler(userId: string, shareToken?: string | null): Promise<TokenResponse> {
  return issuePowerSyncToken({ userId, shareToken })
}
