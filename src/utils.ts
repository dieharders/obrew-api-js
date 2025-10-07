/**
 * Utility functions for Obrew API
 * @module utils
 */

const CONNECTION_KEY = "remote_host";

/**
 * Configuration for remote host connection
 */
export interface HostConnection {
  domain?: string;
  port?: string;
}

/**
 * Retrieve the stored host connection configuration from localStorage
 * @TODO May embed this in consuming app
 * @returns The stored host connection configuration or an empty object
 */
export const getHostConnection = (): HostConnection => {
  if (typeof localStorage === "undefined") return {};

  const data = localStorage.getItem(CONNECTION_KEY);
  const config = data ? JSON.parse(data) : {};
  return config;
};

/**
 * Store the host connection configuration in localStorage
 * @TODO May embed this in consuming app
 * @param newConnection - The new connection configuration to store
 */
export const setHostConnection = (newConnection: HostConnection): void => {
  if (typeof localStorage === "undefined") return;

  const setting = JSON.stringify(newConnection);
  localStorage.setItem(CONNECTION_KEY, setting);
};

/**
 * Default port for Obrew API
 */
export const defaultPort = "8008";

/**
 * Default domain for Obrew API
 */
export const defaultDomain = "http://localhost";

/**
 * Create a fully qualified domain name from stored connection settings
 * @TODO May embed this in consuming app
 * @returns The complete origin URL (e.g., "http://localhost:8008")
 */
export const createDomainName = (): string => {
  const { port, domain } = getHostConnection();
  const PORT = port || defaultPort;
  const DOMAIN = domain === "0.0.0.0" ? defaultDomain : domain || defaultDomain;
  const origin = `${DOMAIN}:${PORT}`;
  return origin;
};
