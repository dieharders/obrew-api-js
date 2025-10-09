import { createServices, fetchAPIConfig, connect } from "./api";
import { I_ObrewConnection, I_ObrewConfig } from "./types";
import { DEFAULT_OBREW_CONNECTION } from "./utils";

// index.ts should export this file as the main lib for the end dev to use in their project in addition to the type defs.
// everything else is just used internally with client.ts providing the developer interface.

/**
 * ObrewClient responsibilities:
 * 1. Handle connections and server config (track host/port in mem)
 * 2. Provide wrapper functions around obrew api
 * 3. Handle teardown/cleanup of network calls, etc when client unmounts/disconnects
 */
export class ObrewClient {
  private isConnected = false
  private abortController: AbortController | null = null
  private connection: I_ObrewConnection = DEFAULT_OBREW_CONNECTION

    /**
   * Initialize connection to Obrew backend.
   */
  async connect(config: I_ObrewConfig): Promise<boolean> {
    if (this.isConnected) {
        console.log('[obrew] Connection is already active!')
        return false
    }
    try {
      // Attempt handshake connection
      const connSuccess = await connect(config)
      if (!connSuccess?.success) throw new Error(connSuccess?.message);
      // Get API configuration and create services
      const apiConfig = await fetchAPIConfig(config)
      if (!apiConfig) throw new Error("No api returned.");
      const serviceApis = createServices(config, apiConfig)

      if (serviceApis) {
        this.isConnected = true
        console.log('[obrew] Successfully connected to Obrew API')
        // Store config in connection after successful connect
        this.connection = {config, api: serviceApis}
        return true
      }

      return false
    } catch (error) {
      console.error('[obrew] Failed to connect to Obrew:', error)
      this.isConnected = false
      return false
    }
  }

  /**
   * Ping server to check if it's responsive.
   * Used for server discovery and health checks.
   */
  async ping(
    timeout = 5000
  ): Promise<{
    success: boolean
    responseTime?: number
    error?: string
  }> {
    const {domain: url, port} = this.connection.config
    const endpointHealth = `${url}:${port}/api/health`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const startTime = performance.now()

    try {
      // Try to get API config as a health check
      const response = await fetch(endpointHealth, {
        signal: controller.signal,
        method: 'GET',
      })

      const responseTime = Math.round(performance.now() - startTime)
      clearTimeout(timeoutId)

      if (response.ok) {
        return { success: true, responseTime }
      }

      return { success: false, error: `HTTP ${response.status}` }
    } catch (error) {
      clearTimeout(timeoutId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  /**
   * Cancel ongoing request
   */
  cancelRequest(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * Disconnect from service
   */
  disconnect(): void {
    this.cancelRequest()
    this.connection.api = null
    this.isConnected = false
  }
}

// Export singleton instance
export const obrewClient = new ObrewClient()