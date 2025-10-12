import { createServices, fetchAPIConfig, connect as apiConnect } from './api'
import {
  I_Connection,
  I_ConnectionConfig,
  Message,
  I_InferenceGenerateOptions,
  I_Message,
  I_HardwareInfo,
  I_Text_Settings,
  T_InstalledTextModel,
} from './types'
import {
  DEFAULT_OBREW_CONNECTION,
  SSE_COMMENT_PREFIX,
  SSE_DATA_PREFIX,
  SSE_EVENT_PREFIX,
} from './utils'

type onChatResponseCallback = (text: string | ((t: string) => void)) => void

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
      console.log('[obrew-client] Connection is already active!')
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
          '[obrew-client] Successfully connected to Obrew API\n',
          config
        )
        return true
      }
      // Failed
      return false
    } catch (error) {
      console.error('[obrew-client] Failed to connect to Obrew:', error)
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

  // Core Helper Methods //

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
   * Handle server sent event stream for AI chats
   * // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
   * @TODO See if this is needed or can be merged with above?
   */
  private async processSseStream(
    fetchStream: Response,
    {
      onData,
      onFinish,
      onEvent,
      onComment,
    }: {
      onData: (str: string) => Promise<void>
      onFinish: () => Promise<void>
      onEvent?: (str: string) => Promise<void>
      onComment?: (str: string) => Promise<void>
    },
    abortRef: AbortController | null = null
  ) {
    const reader = fetchStream.body?.getReader()

    if (!reader) {
      return // If reader is not available
    }

    const decoder = new TextDecoder('utf-8')

    let readingBuffer = await reader.read()
    while (!readingBuffer.done && !abortRef) {
      try {
        const result =
          typeof readingBuffer.value === 'string'
            ? readingBuffer.value
            : decoder.decode(readingBuffer.value, { stream: true })

        const lines = result.split('\n')

        for (const line of lines) {
          if (line?.startsWith(SSE_COMMENT_PREFIX)) {
            const comment = line.slice(SSE_COMMENT_PREFIX.length).trim()
            await onComment?.(comment)
          }

          if (line?.startsWith(SSE_EVENT_PREFIX)) {
            const eventName = line.slice(SSE_EVENT_PREFIX.length).trim()
            await onEvent?.(eventName)
          }

          if (line?.startsWith(SSE_DATA_PREFIX)) {
            const eventData = line.slice(SSE_DATA_PREFIX.length).trim()
            await onData(eventData)
          }
        }
      } catch (err) {
        console.log('[obrew-client] Error reading stream data buffer:', err)
      }

      readingBuffer = await reader.read()
    }

    if (!readingBuffer.done) {
      await reader.cancel()
    }

    await onFinish()
  }

  // Core API Methods //

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

  // @TODO See if below can be used or merged with sendMessage. This came from obrew studio webui.
  //
  async getCompletion({
    options,
    signal,
  }: {
    options: I_InferenceGenerateOptions
    signal: AbortSignal
  }) {
    // this.abortController = new AbortController();
    try {
      return this.connection?.api?.textInference.generate({
        body: options,
        signal: signal, // controller.current.signal,
      })
    } catch (error) {
      console.log(`[obrew-client] Prompt completion error: ${error}`)
      // toast.error(`Prompt completion error: ${error}`);
      return
    }
  }

  onNonStreamResult({
    result,
    setResponseText,
  }: {
    result: any
    setResponseText?: onChatResponseCallback
  }) {
    console.log('[obrew-client] non-stream finished!')
    if (result?.text) setResponseText?.(result?.text)
  }

  async onStreamResult({
    result,
    setResponseText,
  }: {
    result: string
    setResponseText?: onChatResponseCallback
  }) {
    try {
      // Server sends data back
      const parsedResult = result ? JSON.parse(result) : null
      const data = parsedResult?.data
      const eventName = parsedResult?.event
      const text = data?.text
      if (text)
        setResponseText?.(prevText => {
          // Overwrite prev response if final content is received
          if (eventName === 'GENERATING_CONTENT') return text
          return (prevText += text)
        })
      return
    } catch (err) {
      console.log(
        '[obrew-client] onStreamResult err:',
        typeof result,
        ' | ',
        err
      )
      return
    }
  }

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
    console.log(`[obrew-client] onStreamEvent ${eventName}`)
  }

  async append(
    prompt: I_Message,
    setEventState: (ev: string) => void,
    setIsLoading: (b: boolean) => void
  ) {
    if (!prompt) return

    // Create an id for the assistant's response
    // setResponseId(nanoid())

    // Create new message for user's prompt
    const newUserMsg: I_Message = {
      id: prompt.id,
      role: prompt.role,
      content: prompt.content, // always assign prompt content w/o template
      createdAt: prompt.createdAt,
      ...(prompt.role === 'user' && { username: prompt?.username || '' }),
      ...(prompt.role === 'assistant' && { modelId: prompt?.modelId || '' }),
    }
    // Add to/Update messages list
    // setCurrentMessages(prev => {
    //   if (!currentThreadId.current) {
    //     return [newUserMsg]
    //   }
    //   return [...prev, newUserMsg]
    // })

    // Create new thread
    // setThreads({})

    // Request response
    try {
      // Reset state
      // setResponseText('')
      // setIsLoading(true)
      // abortRef.current = false

      // Send request completion for prompt
      console.log(
        '[obrew-client] Sending request to inference server...',
        newUserMsg
      )
      // const mode =
      //   settings?.attention?.response_mode || DEFAULT_CONVERSATION_MODE
      // const options: I_InferenceGenerateOptions = {
      //   responseMode: mode,
      //   toolResponseMode: settings?.attention?.tool_response_mode,
      //   toolUseMode: settings?.attention?.tool_use_mode,
      //   tools: settings?.tools?.assigned,
      //   prompt: prompt?.content,
      //   promptTemplate: settings?.prompt?.promptTemplate?.text,
      //   systemMessage: settings?.system?.systemMessage,
      //   memory: settings?.memory,
      //   ...settings?.performance,
      //   ...settings?.response,
      // }

      // @TODO Call a specific agent by name
      const response = {} as Response // await this.getCompletion(options)
      // console.log('[obrew-client] Prompt response', response)

      // Check success if streamed
      if (response?.body?.getReader) {
        // Process the stream into text tokens
        await this.processSseStream(
          response,
          {
            onData: (res: string) => this.onStreamResult({ result: res }),
            onFinish: async () => {
              console.log('[obrew-client] stream finished!')
              return
            },
            onEvent: async str => {
              this.onStreamEvent(str)
              const displayEventStr = str.replace(/_/g, ' ') + '...'
              if (str) setEventState(displayEventStr)
            },
            onComment: async str => {
              console.log('[obrew-client] onComment', str)
              return
            },
          },
          this.abortController
        )
      }

      // Check success if not streamed
      else this.onNonStreamResult({ result: response })

      // Save final results
      // setCurrentMessages()

      // Finish
      setIsLoading(false)
      return
    } catch (err) {
      setIsLoading(false)
      console.log(`[obrew-client] ${err}`)
      // toast.error(`Prompt request error: \n ${err}`)
    }
  }

  // End @TODO //

  stopChat() {
    this.abortController?.abort()
    this.connection?.api?.textInference.stop()
  }

  /**
   * Install/download a model from a repository
   * @param repoId - The repository ID of the model to install (e.g., "TheBloke/Mistral-7B-Instruct-v0.2-GGUF")
   * @param filename - Optional specific filename to download from the repository
   * @returns The download result message
   * @throws Error if not connected or download fails
   */
  async installModel(repoId: string, filename?: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      // Note: Server expects snake_case parameters
      const body: { repo_id: string; filename?: string } = { repo_id: repoId }
      if (filename) {
        body.filename = filename
      }

      const response = await this.connection?.api?.textInference.download({
        body,
      })

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
   * raw_input: Optional[bool] = False  # user can send manually formatted messages
     responseMode: Optional[str] = DEFAULT_CHAT_MODE
     toolUseMode: Optional[str] = DEFAULT_TOOL_USE_MODE
     toolSchemaType: Optional[str] = DEFAULT_TOOL_SCHEMA_TYPE
     init: LoadTextInferenceInit
     call: LoadTextInferenceCall
     messages: Optional[List[ChatMessage]] = None
   * @throws Error if not connected or model loading fails
   */
  async loadModel(modelPath: string, modelId: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const results = await this.connection?.api?.textInference.load({
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
      if (!result || result.length <= 0) throw new Error('No results.')
      return result
    } catch (error) {
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
   * Load agent/bot configuration settings
   * @param botName - Optional bot name to filter configurations
   * @returns Array of agent configurations (empty array if none found)
   * @throws Error if not connected or load fails
   */
  async loadAgentConfig(botName?: string): Promise<I_Text_Settings> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Obrew service')
    }

    try {
      const response = await this.connection?.api?.storage?.getBotSettings({
        ...(botName && { queryParams: { botName } }),
      })
      const config = response?.data?.find(c => c.model.botName === botName)
      if (!config) throw new Error('No config found.')
      return config
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to load agent config: ${message}`)
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
      return response?.data || []
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      throw new Error(`Failed to audit hardware: ${message}`)
    }
  }
}

// Export singleton instance
export const obrewClient = new ObrewClient()
