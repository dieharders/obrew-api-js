/**
 * Utility functions for Obrew API
 * @module utils
 */

import { I_ConnectionConfig, I_Connection } from './types'

// Chat events
export const SSE_DATA_PREFIX = 'data:'
export const SSE_EVENT_PREFIX = 'event:'
export const SSE_COMMENT_PREFIX = ':'

/**
 * Default port for Obrew API
 */
export const defaultPort = '8008'
/**
 * Default domain for Obrew API
 * @TODO We need a method to tell whether the app is currently running locally (dev-mode) or hosted on server (web).
 */
export const defaultDomain = 'http://localhost'
export const DEFAULT_OBREW_CONFIG: I_ConnectionConfig = {
  domain: defaultDomain,
  port: defaultPort,
  version: 'v1',
  enabled: false, // Disabled by default until connected
}
export const DEFAULT_OBREW_CONNECTION: I_Connection = {
  config: DEFAULT_OBREW_CONFIG,
  api: null,
}

/**
 * Create a fully qualified domain name from stored connection settings
 * @returns The complete origin URL (e.g., "http://localhost:8008")
 */
export const createDomainName = (config: I_ConnectionConfig): string => {
  const { port, domain } = config
  const PORT = port || defaultPort
  const DOMAIN = domain === '0.0.0.0' ? defaultDomain : domain || defaultDomain
  const origin = `${DOMAIN}:${PORT}`
  return origin
}
