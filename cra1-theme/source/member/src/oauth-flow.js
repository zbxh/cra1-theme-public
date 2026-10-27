import { get } from './lib'
import { createOAuthFlow } from './lib/oauth-session'

export const startOAuth = createOAuthFlow({
  request: get,
  open: (...args) => window.open(...args),
  origin: location.origin,
})
