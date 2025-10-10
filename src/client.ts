import { createServices, fetchAPIConfig, connect } from "./api";
import { I_Connection, I_ConnectionConfig, Message, I_InferenceGenerateOptions } from "./types";
import { DEFAULT_OBREW_CONNECTION } from "./utils";

/**
 * ObrewClient responsibilities:
 * 1. Handle connections and server config (track host/port in mem)
 * 2. Provide wrapper functions around obrew api
 * 3. Handle teardown/cleanup of network calls, etc when client unmounts/disconnects
 */
class ObrewClient {
  private hasConnected = false
  private abortController: AbortController | null = null
  private connection: I_Connection = DEFAULT_OBREW_CONNECTION

  // Data Methods //
  
  /**
  * Check if service is connected
  */
  isConnected(): boolean {
    return this.hasConnected && !!this.connection.api && this.connection.config.enabled
  }

  /**
   * Return the current connection
   */
  getConnection(): I_Connection {
    return this.connection
  }

  // Connection Methods //

  /**
  * Initialize connection to Obrew backend.
  */
  async connect({config, signal}: {config: I_ConnectionConfig, signal?: AbortSignal}): Promise<boolean> {
    if (this.hasConnected) {
        console.log('[obrew] Connection is already active!')
        return false
    }
    try {
      // Attempt handshake connection
      const connSuccess = await connect({config, ...(signal && {signal})})
      if (!connSuccess?.success) throw new Error(connSuccess?.message);
      // Get API configuration and create services
      const apiConfig = await fetchAPIConfig(config)
      if (!apiConfig) throw new Error("No api returned.");
      const serviceApis = createServices(config, apiConfig)

      if (serviceApis) {
        this.hasConnected = true
        console.log('[obrew] Successfully connected to Obrew API')
        // Store config in connection after successful connect
        this.connection = {config, api: serviceApis}
        return true
      }

      return false
    } catch (error) {
      console.error('[obrew] Failed to connect to Obrew:', error)
      this.hasConnected = false
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
    // const {domain: url, port} = this.connection.config
    // const endpointHealth = `${url}:${port}/api/health`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const startTime = performance.now()

    try {
      const connSuccess = await connect({config: this.connection.config, signal: controller.signal})
      clearTimeout(timeoutId)
      // Check
      if (!connSuccess?.success) throw new Error(connSuccess?.message);
      return { success: true, responseTime: Math.round(performance.now() - startTime) }      
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
    this.hasConnected = false
  }

  // Core API Helper Methods //

  /**
   * Handle streaming response from AI
   */
  private async handleStreamingResponse(response: Response): Promise<string> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No reader available for streaming response')
    }

    const decoder = new TextDecoder()
    let fullText = ''

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        // Process SSE format
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              fullText += this.extractTextFromResponse(parsed)
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return fullText
  }

  /**
   * Extract text from various response formats
   */
  private extractTextFromResponse(response: any): string {
    // Handle NonStreamPlayground format
    if (response.text) {
      return response.text
    }

    // Handle NonStreamChatbotResponse format
    if (response.response) {
      return response.response
    }

    // Handle GenericAPIResponse format
    if (response.data && typeof response.data === 'string') {
      return response.data
    }

    // Handle raw choices array
    if (response.choices && Array.isArray(response.choices)) {
      return (
        response.choices[0]?.text || response.choices[0]?.message?.content || ''
      )
    }

    // Fallback to string conversion
    return String(response)
  }
  
  /**
   * Send a message and get AI response
   * Handles both streaming and non-streaming responses
   */
  async sendMessage(
    messages: Message[],
    options?: Partial<I_InferenceGenerateOptions>
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    // Create new abort controller for this request
    this.abortController = new AbortController()

    try {
      const response = await this.connection?.api?.textInference.generate({
        body: {
          messages,
          responseMode: 'chat',
          temperature: 0.7,
          max_tokens: 2048,
          stream: false, // @TODO Non-streaming for now
          ...options,
        },
        signal: this.abortController.signal,
      })

      if (!response) {
        throw new Error('No response from AI service')
      }

      // Handle different response types
      if (typeof response === 'string') {
        return response
      }

      // Handle Response object (streaming)
      // Check if it's a Response-like object with headers and body
      if (
        typeof response === 'object' &&
        response !== null &&
        'headers' in response &&
        'body' in response
      ) {
        const httpResponse = response as Response
        const contentType = httpResponse.headers.get('content-type')
        if (contentType?.includes('event-stream')) {
          // Handle streaming response
          return await this.handleStreamingResponse(httpResponse)
        } else {
          // Handle JSON response
          const data = await httpResponse.json()
          return this.extractTextFromResponse(data)
        }
      }

      // Handle structured response objects
      return this.extractTextFromResponse(response)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request was cancelled')
      }
      throw error
    }
  }

  /**
   * Load a text model
   */
  async loadModel(modelPath: string, modelId: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      await this.connection?.api?.textInference.load({
        body: {
          modelPath,
          modelId,
          init: {
            n_ctx: 4096,
            n_threads: 4,
            n_gpu_layers: -1,
          },
          call: {
            temperature: 0.7,
            max_tokens: 2048,
          },
        },
      })
      return true
    } catch (error) {
      console.error('Failed to load model:', error)
      return false
    }
  }

  /**
   * Get currently loaded model info
   */
  async getLoadedModel() {
    if (!this.isConnected()) {
      return null
    }

    try {
      const response = await this.connection?.api?.textInference.model()
      return response?.data || null
    } catch (error) {
      console.error('Failed to get loaded model:', error)
      return null
    }
  }

  /**
   * Get list of installed models
   */
  async getInstalledModels() {
    if (!this.isConnected()) {
      return []
    }

    try {
      const response = await this.connection?.api?.textInference.installed()
      return response?.data || []
    } catch (error) {
      console.error('Failed to get installed models:', error)
      return []
    }
  }
}

// Export singleton instance
export const obrewClient = new ObrewClient()
