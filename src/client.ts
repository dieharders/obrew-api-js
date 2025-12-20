import { createServices, fetchAPIConfig, connect as apiConnect } from './api'
import {
  I_Connection,
  I_ConnectionConfig,
  Message,
  I_InferenceGenerateOptions,
  I_HardwareInfo,
  I_Text_Settings,
  T_InstalledTextModel,
  T_InstalledVisionEmbeddingModel,
  I_VisionEmbedDownloadResponse,
  I_LoadedVisionModelRes,
  I_VisionEmbedLoadRequest,
  I_VisionEmbedLoadResponse,
  I_VisionEmbedModelInfo,
  I_VisionEmbedRequest,
  I_VisionEmbedResponse,
  I_VisionEmbedQueryRequest,
  I_VisionEmbedQueryResponse,
  I_LLM_Init_Options,
  I_LLM_Call_Options,
} from './types'
import {
  DEFAULT_OBREW_CONNECTION,
  SSE_COMMENT_PREFIX,
  SSE_DATA_PREFIX,
  SSE_EVENT_PREFIX,
} from './utils'

const LOG_PREFIX = '[obrew-client]'

/**
 * ObrewClient responsibilities:
 * 1. Handle connections and server config (track host/port in mem)
 * 2. Provide wrapper functions around obrew api
 * 3. Handle teardown/cleanup of network calls, etc when client unmounts/disconnects
 */
class ObrewClient {
  private hasConnected = false
  private activeRequests: Map<string, AbortController> = new Map()
  private connection: I_Connection = DEFAULT_OBREW_CONNECTION

  // Data Methods //

  /**
   * Check if service is connected
   */
  isConnected(): boolean {
    return (
      this.hasConnected &&
      !!this.connection.api &&
      this.connection.config.enabled
    )
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
  async connect({
    config,
    signal,
  }: {
    config: I_ConnectionConfig
    signal?: AbortSignal
  }): Promise<boolean> {
    if (this.hasConnected) {
      console.log(`${LOG_PREFIX} Connection is already active!`)
      return false
    }
    try {
      // Attempt handshake connection
      const connSuccess = await apiConnect({
        config,
        ...(signal && { signal }),
      })
      if (!connSuccess?.success) throw new Error(connSuccess?.message)
      // Get API configuration and create services
      const apiConfig = await fetchAPIConfig(config)
      if (!apiConfig) throw new Error('No api returned.')
      const serviceApis = createServices(config, apiConfig)
      // Success
      if (serviceApis) {
        this.hasConnected = true
        // Store config in connection after successful connect
        const enabledConfig = { ...config, enabled: true }
        this.connection = { config: enabledConfig, api: serviceApis }
        console.log(
          `${LOG_PREFIX} Successfully connected to Obrew API\n${config}`
        )
        return true
      }
      // Failed
      return false
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to connect to Obrew: ${error}`)
      this.hasConnected = false
      return false
    }
  }

  /**
   * Ping server to check if it's responsive.
   * Used for server discovery and health checks.
   */
  async ping(timeout = 5000): Promise<{
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
      const connSuccess = await apiConnect({
        config: this.connection.config,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      // Check
      if (!connSuccess?.success) throw new Error(connSuccess?.message)
      return {
        success: true,
        responseTime: Math.round(performance.now() - startTime),
      }
    } catch (error) {
      clearTimeout(timeoutId)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  /**
   * Cancel ongoing request(s)
   * @param requestId - Optional specific request ID to cancel. If not provided, cancels all active requests.
   */
  cancelRequest(requestId?: string): void {
    if (requestId) {
      // Cancel specific request
      const controller = this.activeRequests.get(requestId)
      if (controller) {
        controller.abort()
        this.activeRequests.delete(requestId)
      }
    } else {
      // Cancel all active requests
      this.activeRequests.forEach(controller => controller.abort())
      this.activeRequests.clear()
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

  // Core Helper Methods //

  /**
   * Check if an error is a connection/network error
   * If so, mark the client as disconnected
   */
  private handlePotentialConnectionError(error: unknown): void {
    if (
      error instanceof Error &&
      (error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('ERR_CONNECTION'))
    ) {
      console.warn(`${LOG_PREFIX} Connection lost, marking as disconnected`)
      this.hasConnected = false
    }
  }

  /**
   * Extract text from various response formats
   * Handles multiple response types from different API endpoints
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
   * Unified streaming response handler for SSE (Server-Sent Events)
   * Supports both simple text accumulation and advanced callback-based streaming
   * https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
   * @param response - The Response object containing the stream
   * @param options - Configuration options for handling the stream
   * @param abortRef - Optional external AbortController to cancel the stream (separate from class's abortController)
   */
  private async handleStreamResponse(
    response: Response,
    options?: {
      onData?: (str: string) => void | Promise<void>
      onFinish?: () => void | Promise<void>
      onEvent?: (str: string) => void | Promise<void>
      onComment?: (str: string) => void | Promise<void>
      extractText?: boolean // If true, accumulate and return text
    },
    abortRef?: AbortController | null
  ): Promise<string> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No reader available for streaming response')
    }

    const decoder = new TextDecoder('utf-8')
    let fullText = ''
    const extractText = options?.extractText ?? true

    // Set up abort handler to cancel reader when abort signal fires
    // This is needed because reader.read() blocks and won't respond to the signal otherwise
    const abortHandler = () => {
      reader.cancel().catch(() => {}) // Ignore errors on cancel
    }
    if (abortRef?.signal) {
      abortRef.signal.addEventListener('abort', abortHandler)
    }

    try {
      let readingBuffer = await reader.read()

      // Check both external abortRef (if provided) and internal abortController
      while (!readingBuffer.done && !abortRef?.signal.aborted) {
        try {
          const chunk =
            typeof readingBuffer.value === 'string'
              ? readingBuffer.value
              : decoder.decode(readingBuffer.value, { stream: true })

          const lines = chunk.split('\n')

          for (const line of lines) {
            // Handle SSE comments
            if (line?.startsWith(SSE_COMMENT_PREFIX)) {
              const comment = line.slice(SSE_COMMENT_PREFIX.length).trim()
              await options?.onComment?.(comment)
            }

            // Handle SSE events
            if (line?.startsWith(SSE_EVENT_PREFIX)) {
              const eventName = line.slice(SSE_EVENT_PREFIX.length).trim()
              await options?.onEvent?.(eventName)
            }

            // Handle SSE data
            if (line?.startsWith(SSE_DATA_PREFIX)) {
              const eventData = line.slice(SSE_DATA_PREFIX.length).trim()

              // Check for stream completion marker
              if (eventData === '[DONE]') {
                break
              }

              // Call onData callback if provided
              await options?.onData?.(eventData)

              // Also accumulate text if extractText is enabled
              if (extractText) {
                try {
                  const parsed = JSON.parse(eventData)
                  fullText += this.extractTextFromResponse(parsed)
                } catch {
                  // If not JSON, treat as plain text
                  fullText += eventData
                }
              }
            }

            // Support legacy "data: " format (without SSE prefix constant)
            if (
              !line.startsWith(SSE_DATA_PREFIX) &&
              line.startsWith('data: ')
            ) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              await options?.onData?.(data)

              if (extractText) {
                try {
                  const parsed = JSON.parse(data)
                  fullText += this.extractTextFromResponse(parsed)
                } catch {
                  fullText += data
                }
              }
            }
          }
        } catch (err) {
          console.log(`${LOG_PREFIX} Error reading stream data buffer: ${err}`)
        }

        readingBuffer = await reader.read()
      }

      // Cancel if not done (e.g., aborted)
      if (!readingBuffer.done) {
        await reader.cancel()
      }
    } finally {
      // Clean up abort listener
      if (abortRef?.signal) {
        abortRef.signal.removeEventListener('abort', abortHandler)
      }
      reader.releaseLock()
    }

    // Call finish callback (only if not aborted)
    if (!abortRef?.signal.aborted) {
      await options?.onFinish?.()
    }

    return fullText
  }

  // Core API Methods //

  /**
   * Send a message and get AI response
   * Handles both streaming and non-streaming responses
   * @param messages - Array of messages to send
   * @param options - Optional generation options
   * @param setEventState - Optional callback for streaming events
   * @param requestId - Optional unique ID to track this request (for concurrent request support)
   */
  async sendMessage(
    messages: Message[],
    options?: Partial<I_InferenceGenerateOptions>,
    setEventState?: (ev: string) => void,
    requestId?: string
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    // Generate unique request ID if not provided
    const reqId = requestId || crypto.randomUUID()

    // Create new abort controller for this specific request
    const abortController = new AbortController()
    this.activeRequests.set(reqId, abortController)

    try {
      const response = await this.connection?.api?.textInference.generate({
        body: {
          messages,
          ...options,
        },
        signal: abortController.signal,
      })

      // Handle possible errors
      if (!response) throw new Error('No response from AI service')
      // Check for error responses (only applies to object responses with success property)
      if (
        typeof response === 'object' &&
        response !== null &&
        'success' in response &&
        response.success === false
      ) {
        throw new Error(`No response from AI service: ${response.message}`)
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
          return await this.handleStreamResponse(
            httpResponse,
            {
              onData: (res: string) => {
                console.log(`onData:\n${res}`)
              },
              onFinish: async () => {
                console.log(`${LOG_PREFIX} stream finished!`)
                return
              },
              onEvent: async (str: string) => {
                this.onStreamEvent(str)
                const displayEventStr = str.replace(/_/g, ' ') + '...'
                if (str) setEventState?.(displayEventStr)
              },
              onComment: async (str: string) => {
                console.log(`${LOG_PREFIX} onComment:\n${str}`)
                return
              },
              extractText: false, // Don't accumulate text, use callbacks instead
            },
            abortController
          )
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

      // Check if this is a connection error and update state
      this.handlePotentialConnectionError(error)

      throw error
    } finally {
      // Clean up the request from activeRequests
      this.activeRequests.delete(reqId)
    }
  }

  /**
   * Handle streaming events
   */
  onStreamEvent(eventName: string) {
    switch (eventName) {
      case 'FEEDING_PROMPT':
        break
      case 'GENERATING_TOKENS':
        break
      case 'GENERATING_CONTENT':
        break
      default:
        break
    }
    console.log(`${LOG_PREFIX} onStreamEvent ${eventName}`)
  }

  stopChat() {
    this.cancelRequest()
    this.connection?.api?.textInference.stop()
  }

  /**
   * Install/download a model from a repository
   * @param repoId - The repository ID of the model to install (e.g., "TheBloke/Mistral-7B-Instruct-v0.2-GGUF")
   * @param filename - Optional specific filename to download from the repository
   * @param mmprojRepoId - Optional repo ID for mmproj file (for multimodal/vision models)
   * @param mmprojFilename - Optional filename for mmproj file (for multimodal/vision models)
   * @returns The download result message
   * @throws Error if not connected or download fails
   */
  async installModel(
    repoId: string,
    filename?: string,
    mmprojRepoId?: string,
    mmprojFilename?: string
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      // Note: Server expects snake_case parameters
      const body: {
        repo_id: string
        filename?: string
        mmproj_repo_id?: string
        mmproj_filename?: string
      } = { repo_id: repoId }
      if (filename) {
        body.filename = filename
      }
      if (mmprojRepoId) {
        body.mmproj_repo_id = mmprojRepoId
      }
      if (mmprojFilename) {
        body.mmproj_filename = mmprojFilename
      }

      const response = await this.connection?.api?.textInference.download({
        body,
      })

      // Check if the response indicates an error
      if (response?.success === false) {
        const errorMsg = response?.message || 'Unknown error occurred'
        throw new Error(errorMsg)
      }

      // Server returns {success: true, message: "...", data: null}
      // Return the message field which contains the success info
      if (response?.message) {
        return response.message
      }

      // Fallback to data field if message is not available
      if (response?.data) {
        return response.data
      }

      throw new Error('No response data from model installation')
    } catch (error) {
      // Check if this is a connection error and update state
      this.handlePotentialConnectionError(error)

      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to install model: ${message}`)
    }
  }

  /**
   * Uninstall/delete a model from server
   * @param repoId - The repository ID of the model to delete
   * @param filename - The filename of the model to delete
   * @throws Error if not connected or deletion fails
   */
  async uninstallModel(repoId: string, filename: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      await this.connection?.api?.textInference.delete({
        body: {
          repoId,
          filename,
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to uninstall model: ${message}`)
    }
  }

  /**
   * Load a text model
   * @param modelPath - The file path to the model
   * @param modelId - The unique identifier for the model
   * @throws Error if not connected or model loading fails
   */
  async loadModel({
    modelId,
    modelSettings,
    modelPath,
  }: {
    modelId: string
    modelSettings: I_Text_Settings
    modelPath?: string
  }): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const results = await this.connection?.api?.textInference.load({
        body: {
          modelPath,
          modelId,
          init: {
            ...modelSettings.performance,
          },
          call: {
            ...modelSettings.response,
          },
          raw_input: false, // user can send manually formatted messages
          responseMode: modelSettings.attention.response_mode,
          toolUseMode: modelSettings.attention.tool_use_mode,
          // toolSchemaType: modelSettings.tools.assigned
          // messages?: [] || null
        },
      })
      if (!results) throw new Error('No results for loaded model.')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to load model: ${message}`)
    }
  }

  /**
   * Unload the currently loaded text model
   * @throws Error if not connected or unloading fails
   */
  async unloadModel(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      await this.connection?.api?.textInference.unload()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to unload model: ${message}`)
    }
  }

  /**
   * Get currently loaded model info
   * @returns The loaded model data, or null if no model is loaded
   * @throws Error if not connected or request fails
   */
  async getLoadedModel() {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.textInference.model()
      return response?.data || null
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to get loaded model: ${message}`)
    }
  }

  /**
   * Get list of installed models
   * @returns Array of installed models (empty array if none installed)
   * @throws Error if not connected or request fails
   */
  async getInstalledModels(): Promise<T_InstalledTextModel[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.textInference.installed()
      const result = response?.data
      // Return empty array if no models are installed (valid state)
      if (!result || result.length <= 0) return []
      return result
    } catch (error) {
      // Check if this is a connection error and update state
      this.handlePotentialConnectionError(error)

      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to get installed models: ${message}`)
    }
  }

  /**
   * Save agent/bot configuration settings
   * @param config - The agent configuration settings to save
   * @returns Array of all saved agent configurations
   * @throws Error if not connected or save fails
   */
  async saveAgentConfig(config: I_Text_Settings): Promise<I_Text_Settings[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.storage?.saveBotSettings({
        body: config,
      })
      return response?.data || []
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to save agent config: ${message}`)
    }
  }

  /**
   * Return the agent/bot configuration settings
   * @param botName - Bot name to filter configurations
   * @returns Array of agent configurations (empty array if none found)
   * @throws Error if not connected or load fails
   */
  async getAgentConfig(botName: string): Promise<I_Text_Settings | null> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.storage?.getBotSettings({
        ...(botName && { queryParams: { botName } }),
      })
      const config = response?.data?.find(c => c.model.botName === botName)
      return config || null
    } catch (error) {
      // Check if this is a connection error and update state
      this.handlePotentialConnectionError(error)

      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to get agent config: ${message}`)
    }
  }

  /**
   * Delete agent/bot configuration settings
   * @param botName - The bot name to delete
   * @returns Array of remaining agent configurations
   * @throws Error if not connected or deletion fails
   */
  async deleteAgentConfig(botName: string): Promise<I_Text_Settings[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.storage?.deleteBotSettings({
        queryParams: { botName },
      })
      return response?.data || []
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to delete agent config: ${message}`)
    }
  }

  /**
   * Get hardware information (GPU details, VRAM, etc.)
   * @returns Array of hardware information (empty array if no hardware found)
   * @throws Error if not connected or audit fails
   */
  async auditHardware(): Promise<I_HardwareInfo[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.textInference.auditHardware()
      const results = response?.data || []
      console.log(`${LOG_PREFIX} Hardware audit result:`, results)
      return results
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to audit hardware: ${message}`)
    }
  }

  // Embedding Model Methods //

  /**
   * Download an embedding model from HuggingFace
   * @param repoId - The repository ID of the embedding model (e.g., "intfloat/multilingual-e5-large-instruct")
   * @returns Success message with model info
   * @throws Error if not connected or download fails
   */
  async installEmbeddingModel(
    repoId: string,
    filename: string
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.memory.downloadEmbedModel({
        body: {
          repo_id: repoId,
          filename,
        },
      })

      // Check if the response indicates an error
      if (response?.success === false) {
        const errorMsg = response?.message || 'Unknown error occurred'
        throw new Error(errorMsg)
      }

      if (response?.message) {
        return response.message
      }

      if (response?.data) {
        return response.data
      }

      throw new Error('No response data from embedding model download')
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to download embedding model: ${message}`)
    }
  }

  /**
   * Get list of installed embedding models
   * @returns Array of installed embedding models
   * @throws Error if not connected or request fails
   */
  async getInstalledEmbeddingModels() {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.memory.installedEmbedModels()

      // Check if the response indicates an error
      if (response?.success === false) {
        const errorMsg = response?.message || 'Unknown error occurred'
        throw new Error(errorMsg)
      }

      return response?.data || []
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to get installed embedding models: ${message}`)
    }
  }

  /**
   * Get list of available embedding models for installation
   * @returns Array of available embedding model configurations
   * @throws Error if not connected or request fails
   */
  async getAvailableEmbeddingModels() {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.memory.availableEmbedModels()
      return response?.data || []
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to get available embedding models: ${message}`)
    }
  }

  /**
   * Delete an installed embedding model
   * @param repoId - The repository ID of the embedding model to delete
   * @returns Success message
   * @throws Error if not connected or deletion fails
   */
  async deleteEmbeddingModel(repoId: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.memory.deleteEmbedModel({
        body: {
          repoId,
        },
      })

      if (response?.message) {
        return response.message
      }

      throw new Error('No response from embedding model deletion')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to delete embedding model: ${message}`)
    }
  }

  /**
   * Get information about an embedding model from HuggingFace
   * @param repoId - The repository ID of the embedding model
   * @returns Model information from HuggingFace
   * @throws Error if not connected or request fails
   */
  async getEmbeddingModelInfo(repoId: string) {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.memory.getEmbedModelInfo({
        queryParams: {
          repoId,
        },
      })
      return response?.data || null
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to get embedding model info: ${message}`)
    }
  }
  // Vision Methods //

  /**
   * Transcribe an image using the vision model
   * @param images - Array of base64 encoded images
   * @param prompt - Optional prompt for transcription (defaults to generic description)
   * @param options - Optional generation options (max_tokens, temperature, etc.)
   * @returns The transcription text
   * @throws Error if not connected, no vision model loaded, or transcription fails
   */
  async transcribeImage(
    images: string[],
    prompt?: string,
    options?: { max_tokens?: number; temperature?: number }
  ): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const defaultPrompt =
        'Describe this image in detail. Include any visible text, diagrams, charts, or important visual elements.'

      const response = await this.connection?.api?.vision?.generate({
        body: {
          prompt: prompt || defaultPrompt,
          images,
          image_type: 'base64',
          stream: false,
          ...options,
        },
      })

      if (!response) {
        throw new Error('No response from vision model')
      }

      // Handle error response
      if (
        typeof response === 'object' &&
        'success' in response &&
        !response.success
      ) {
        throw new Error(
          (response as any).message || 'Vision transcription failed'
        )
      }

      console.log(
        '[ObrewClient] Full vision response:',
        JSON.stringify(response, null, 2)
      )

      // Extract text from response
      if (typeof response === 'object' && 'text' in response) {
        const text = (response as { text: string }).text
        console.log('[ObrewClient] Vision response:', {
          hasText: !!text,
          textLength: text?.length ?? 0,
          responseKeys: Object.keys(response),
        })
        return text
      }

      console.error(
        '[ObrewClient] Unexpected vision response format:',
        response
      )
      throw new Error('Unexpected response format from vision model')
    } catch (error) {
      this.handlePotentialConnectionError(error)

      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to transcribe image: ${message}`)
    }
  }

  /**
   * Load a vision model with its mmproj file
   * @param modelPath - Path to the model GGUF file
   * @param mmprojPath - Path to the mmproj file
   * @param modelId - Unique identifier for the model
   * @param modelSettings - Model initialization and call settings
   * @throws Error if not connected or loading fails
   */
  async loadVisionModel({
    modelId,
    modelSettings,
    modelPath,
    mmprojPath,
  }: {
    modelId: string
    modelSettings: { init: I_LLM_Init_Options; call: I_LLM_Call_Options }
    modelPath?: string
    mmprojPath?: string
  }): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.vision?.load({
        body: {
          modelPath,
          mmprojPath,
          modelId,
          init: modelSettings.init,
          call: modelSettings.call,
        },
      })

      if (!response?.success) {
        throw new Error(
          (response as { message?: string })?.message ||
            'Failed to load vision model'
        )
      }

      console.log(`${LOG_PREFIX} Vision model loaded: ${modelId}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to load vision model: ${message}`)
    }
  }

  /**
   * Unload the currently loaded vision model
   * @throws Error if not connected or unloading fails
   */
  async unloadVisionModel(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      await this.connection?.api?.vision?.unload({})
      console.log(`${LOG_PREFIX} Vision model unloaded`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to unload vision model: ${message}`)
    }
  }

  /**
   * Get currently loaded vision model info
   * @returns The loaded vision model data, or null if no model is loaded
   * @throws Error if not connected or request fails
   */
  async getLoadedVisionModel(): Promise<I_LoadedVisionModelRes | null> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.vision?.model({})
      return response?.data || null
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to get loaded vision model: ${message}`)
    }
  }

  // Vision Embedding Model Methods //

  /**
   * Load a vision embedding model for creating image embeddings
   * @param options - Model loading options including model_path and mmproj_path
   * @returns The loaded model info (name, id)
   * @throws Error if not connected or loading fails
   */
  async loadVisionEmbedModel(
    options: I_VisionEmbedLoadRequest
  ): Promise<I_VisionEmbedLoadResponse> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.vision?.loadEmbedModel({
        body: options,
      })

      if (!response) {
        throw new Error('No response from vision embed load')
      }

      if ('success' in response && !response.success) {
        throw new Error(
          (response as { message?: string })?.message ||
            'Failed to load vision embed model'
        )
      }

      console.log(`${LOG_PREFIX} Vision embed model loaded`)
      return response.data as I_VisionEmbedLoadResponse
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to load vision embed model: ${message}`)
    }
  }

  /**
   * Unload the currently loaded vision embedding model
   * @throws Error if not connected or unloading fails
   */
  async unloadVisionEmbedModel(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      await this.connection?.api?.vision?.unloadEmbedModel({})
      console.log(`${LOG_PREFIX} Vision embed model unloaded`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to unload vision embed model: ${message}`)
    }
  }

  /**
   * Get information about the currently loaded vision embedding model
   * @returns The model info or null if no model is loaded
   * @throws Error if not connected or request fails
   */
  async getVisionEmbedModelInfo(): Promise<I_VisionEmbedModelInfo | null> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.vision?.getEmbedModel({})

      if (!response) {
        return null
      }

      if ('success' in response && !response.success) {
        return null
      }

      return response.data as I_VisionEmbedModelInfo
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to get vision embed model info: ${message}`)
    }
  }

  /**
   * Create an embedding for an image
   * @param options - Embedding options including image data and collection info
   * @returns The embedding result with id, collection name, dimension, and optional transcription
   * @throws Error if not connected, no embed model loaded, or embedding fails
   */
  async createImageEmbedding(
    options: I_VisionEmbedRequest
  ): Promise<I_VisionEmbedResponse> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.vision?.embed({
        body: options,
      })

      if (!response) {
        throw new Error('No response from vision embed')
      }

      if ('success' in response && !response.success) {
        throw new Error(
          (response as { message?: string })?.message ||
            'Failed to create image embedding'
        )
      }

      console.log(`${LOG_PREFIX} Image embedding created:`, response.data)
      return response.data as I_VisionEmbedResponse
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to create image embedding: ${message}`)
    }
  }

  /**
   * Query an image collection using text similarity search
   * @param options - Query options including query text, collection name, and optional top_k
   * @returns The query results with matching images, similarity scores, and metadata
   * @throws Error if not connected, collection not found, or query fails
   */
  async queryImageCollection(
    options: I_VisionEmbedQueryRequest
  ): Promise<I_VisionEmbedQueryResponse> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.vision?.queryImages({
        body: options,
      })

      if (!response) {
        throw new Error('No response from image query')
      }

      if ('success' in response && !response.success) {
        throw new Error(
          (response as { message?: string })?.message ||
            'Failed to query image collection'
        )
      }

      console.log(
        `${LOG_PREFIX} Image query returned ${response.data?.results?.length ?? 0} results`
      )
      return response.data as I_VisionEmbedQueryResponse
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to query image collection: ${message}`)
    }
  }

  /**
   * Download a vision embedding model (GGUF + mmproj) from HuggingFace
   * @param repoId - The HuggingFace repository ID
   * @param filename - The main model GGUF filename
   * @param mmprojFilename - The mmproj GGUF filename
   * @returns The download response with file paths
   * @throws Error if not connected or download fails
   */
  async installVisionEmbedModel(
    repoId: string,
    filename: string,
    mmprojFilename: string
  ): Promise<I_VisionEmbedDownloadResponse> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.vision?.downloadEmbedModel({
        body: {
          repo_id: repoId,
          filename,
          mmproj_filename: mmprojFilename,
        },
      })

      if (!response) {
        throw new Error('No response from vision embed download')
      }

      if ('success' in response && !response.success) {
        throw new Error(
          (response as any).message || 'Failed to download vision embed model'
        )
      }

      console.log(`${LOG_PREFIX} Vision embed model downloaded:`, response.data)
      return response.data as I_VisionEmbedDownloadResponse
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to download vision embed model: ${message}`)
    }
  }

  /**
   * Delete a vision embedding model (GGUF + mmproj)
   * @param repoId - The repository ID of the vision embed model to delete
   * @throws Error if not connected or deletion fails
   */
  async deleteVisionEmbedModel(repoId: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.vision?.deleteEmbedModel({
        body: {
          repoId,
        },
      })

      if (!response) {
        throw new Error('No response from vision embed delete')
      }

      if ('success' in response && !response.success) {
        throw new Error(
          (response as any).message || 'Failed to delete vision embed model'
        )
      }

      console.log(`${LOG_PREFIX} Vision embed model deleted: ${repoId}`)
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to delete vision embed model: ${message}`)
    }
  }

  /**
   * Get list of installed vision embedding models
   * @returns Array of installed vision embedding model metadata
   * @throws Error if not connected or request fails
   */
  async getInstalledVisionEmbedModels(): Promise<
    T_InstalledVisionEmbeddingModel[]
  > {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.vision?.installedEmbedModels(
        {}
      )

      if (!response) {
        throw new Error('No response from vision embed installed models')
      }

      if ('success' in response && !response.success) {
        throw new Error(
          (response as any).message ||
            'Failed to get installed vision embed models'
        )
      }

      // The response data contains the array of installed models
      const models = (response as any).data || []
      console.log(
        `${LOG_PREFIX} Found ${models.length} installed vision embed models`
      )
      return models
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to get installed vision embed models: ${message}`)
    }
  }

  // ==========================================================================
  // Async Download Methods with SSE Progress Tracking
  // ==========================================================================

  /**
   * Unified method to start an async download of any model type with progress tracking.
   * Routes to the appropriate backend endpoint based on modelType.
   * @param options - Download options
   * @returns Object with taskId for tracking progress (null for sync transformer models)
   */
  async startDownload(options: {
    modelType: 'text' | 'embedding' | 'vision-embedding'
    repoId: string
    filename?: string
    mmprojRepoId?: string
    mmprojFilename?: string
  }): Promise<{ taskId: string | null; mmprojTaskId?: string | null }> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    const { modelType, repoId, filename, mmprojRepoId, mmprojFilename } =
      options

    try {
      let response: any
      let taskId: string | null = null
      let mmprojTaskId: string | null = null

      switch (modelType) {
        case 'text': {
          const body: {
            repo_id: string
            filename?: string
            mmproj_repo_id?: string
            mmproj_filename?: string
          } = { repo_id: repoId }
          if (filename) body.filename = filename
          if (mmprojRepoId) body.mmproj_repo_id = mmprojRepoId
          if (mmprojFilename) body.mmproj_filename = mmprojFilename

          response = await this.connection?.api?.textInference.download({
            body,
          })
          taskId = response?.data?.taskId || null
          mmprojTaskId = response?.data?.mmprojTaskId || null
          break
        }

        case 'embedding': {
          response = await this.connection?.api?.memory.downloadEmbedModel({
            body: {
              repo_id: repoId,
              filename: filename || '',
            },
          })
          // GGUF models return taskId, transformer models complete synchronously
          taskId = response?.data?.taskId || null
          mmprojTaskId = response?.data?.mmprojTaskId || null
          break
        }

        case 'vision-embedding': {
          response = await this.connection?.api?.vision?.downloadEmbedModel({
            body: {
              repo_id: repoId,
              filename: filename || '',
              mmproj_filename: mmprojFilename || '',
            },
          })
          taskId = response?.data?.taskId || null
          mmprojTaskId = response?.data?.mmprojTaskId || null
          break
        }
      }

      if (response?.success === false) {
        throw new Error(response?.message || 'Failed to start download')
      }

      console.log(
        `${LOG_PREFIX} Download ${taskId ? `started with taskId: ${taskId}` : 'completed synchronously'}${mmprojTaskId ? ` (mmproj: ${mmprojTaskId})` : ''}`
      )
      return { taskId, mmprojTaskId }
    } catch (error) {
      this.handlePotentialConnectionError(error)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to start download: ${message}`)
    }
  }

  /**
   * Subscribe to download progress via SSE
   * Uses the centralized /v1/downloads/progress endpoint (works for all model types)
   * @param taskId - The task ID from startModelDownload/startEmbeddingModelDownload/startVisionEmbedModelDownload
   * @param callbacks - Progress callbacks
   * @returns AbortController to cancel the subscription
   */
  subscribeToDownloadProgress(
    taskId: string,
    callbacks: {
      onProgress?: (progress: {
        downloadedBytes: number
        totalBytes: number
        percent: number
        speedMbps: number
        etaSeconds: number | null
        status: string
        secondaryTaskId?: string | null
      }) => void
      onComplete?: (filePath?: string) => void
      onError?: (error: string) => void
      onCancel?: () => void
    }
  ): AbortController {
    const abortController = new AbortController()

    // Use API service pattern for centralized downloads endpoint
    this.startDownloadProgressStream(taskId, abortController, callbacks)

    return abortController
  }

  /**
   * Internal method to start the SSE progress stream using API service pattern
   */
  private async startDownloadProgressStream(
    taskId: string,
    abortController: AbortController,
    callbacks: {
      onProgress?: (progress: {
        downloadedBytes: number
        totalBytes: number
        percent: number
        speedMbps: number
        etaSeconds: number | null
        status: string
        secondaryTaskId?: string | null
      }) => void
      onComplete?: (filePath?: string) => void
      onError?: (error: string) => void
      onCancel?: () => void
    }
  ): Promise<void> {
    try {
      // Use API service to get the SSE response (typed as Response via T_StreamingAPIRequest)
      const response = await this.connection?.api?.downloads.progress({
        queryParams: { task_id: taskId },
        signal: abortController.signal,
      })

      if (!response) {
        callbacks.onError?.('No response from progress endpoint')
        return
      }

      await this.streamDownloadProgress(response, abortController, callbacks)
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        callbacks.onCancel?.()
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error'
        callbacks.onError?.(message)
      }
    }
  }

  /**
   * Internal method to stream download progress via SSE
   * @param response - The Response object from the API service
   */
  private async streamDownloadProgress(
    response: Response,
    abortController: AbortController,
    callbacks: {
      onProgress?: (progress: {
        downloadedBytes: number
        totalBytes: number
        percent: number
        speedMbps: number
        etaSeconds: number | null
        status: string
        secondaryTaskId?: string | null
      }) => void
      onComplete?: (filePath?: string) => void
      onError?: (error: string) => void
      onCancel?: () => void
    }
  ): Promise<void> {
    try {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No reader available for SSE response')
      }

      const decoder = new TextDecoder()

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()

        if (done || abortController.signal.aborted) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            if (dataStr === '[DONE]') {
              break
            }

            try {
              const data = JSON.parse(dataStr)

              // Check for error event
              if (data.error) {
                callbacks.onError?.(data.error)
                return
              }

              // Map snake_case to camelCase for callbacks
              const progress = {
                downloadedBytes: data.downloaded_bytes || 0,
                totalBytes: data.total_bytes || 0,
                percent: data.percent || 0,
                speedMbps: data.speed_mbps || 0,
                etaSeconds: data.eta_seconds,
                status: data.status || 'unknown',
                secondaryTaskId: data.secondary_task_id || null,
              }

              callbacks.onProgress?.(progress)

              // Handle terminal states
              if (data.status === 'completed') {
                callbacks.onComplete?.(data.file_path)
                return
              } else if (data.status === 'error') {
                callbacks.onError?.(data.error || 'Download failed')
                return
              } else if (data.status === 'cancelled') {
                callbacks.onCancel?.()
                return
              }
            } catch {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        callbacks.onCancel?.()
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error'
        callbacks.onError?.(message)
      }
    }
  }

  /**
   * Cancel an in-progress download
   * Uses the centralized /v1/downloads endpoint (works for all model types)
   * @param taskId - The task ID to cancel
   */
  async cancelDownload(taskId: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      // Use API service pattern for centralized downloads endpoint
      const response = await this.connection?.api?.downloads.cancel({
        queryParams: { task_id: taskId },
      })

      if (response?.success === false) {
        throw new Error(response?.message || 'Failed to cancel download')
      }

      console.log(`${LOG_PREFIX} Download cancelled: ${taskId}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to cancel download: ${message}`)
    }
  }
}

// Export singleton instance
export const obrewClient = new ObrewClient()
