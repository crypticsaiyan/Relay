function decodeJwtPayload(token: string | undefined): Record<string, unknown> | null {
  if (!token) {
    return null
  }

  const parts = token.split('.')
  if (parts.length < 2) {
    return null
  }

  try {
    const normalized = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(normalized))
  } catch {
    return null
  }
}

function getTokenExpiryMs(token: string | undefined): number | null {
  const payload = decodeJwtPayload(token)
  const exp = typeof payload?.exp === 'number' ? payload.exp : null
  return exp ? exp * 1000 : null
}

const powerSyncUrl = import.meta.env.VITE_POWERSYNC_URL as string | undefined
const powerSyncDevToken = import.meta.env.VITE_POWERSYNC_DEV_TOKEN as string | undefined
const localBridgeOverride = import.meta.env.VITE_RELAY_USE_LOCAL_BRIDGE === 'true'
const powerSyncConfigured = Boolean(powerSyncUrl && powerSyncDevToken)
const powerSyncTokenExpiryMs = getTokenExpiryMs(powerSyncDevToken)

export const POWER_SYNC_TOKEN_EXPIRED =
  powerSyncTokenExpiryMs !== null && Date.now() >= powerSyncTokenExpiryMs

export const USE_LOCAL_RELAY_BRIDGE =
  localBridgeOverride ||
  !powerSyncConfigured ||
  POWER_SYNC_TOKEN_EXPIRED

export function getRelayRuntimeLabel(): string {
  if (USE_LOCAL_RELAY_BRIDGE) {
    return 'Local'
  }

  return 'Synced'
}
