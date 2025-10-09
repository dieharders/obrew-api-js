/**
 * Utility functions for Obrew API
 * @module utils
 */

import { I_ObrewConfig, I_ObrewConnection } from "./types";

/**
 * Default port for Obrew API
 */
export const defaultPort = "8008";
/**
 * Default domain for Obrew API
 * @TODO We need a method to tell whether the app is currently running locally (dev-mode) or hosted on server (web).
 */
export const defaultDomain = "http://localhost";
export const DEFAULT_OBREW_CONFIG: I_ObrewConfig = {
  domain: defaultDomain,
  port: defaultPort,
  enabled: false, // Disabled by default until connected
}
export const DEFAULT_OBREW_CONNECTION: I_ObrewConnection = {
    config: DEFAULT_OBREW_CONFIG,
    api: null
}

/**
 * Create a fully qualified domain name from stored connection settings
 * @returns The complete origin URL (e.g., "http://localhost:8008")
 */
export const createDomainName = (config: I_ObrewConfig): string => {
  const { port, domain } = config;
  const PORT = port || defaultPort;
  const DOMAIN = domain === "0.0.0.0" ? defaultDomain : domain || defaultDomain;
  const origin = `${DOMAIN}:${PORT}`;
  return origin;
};
