// src/utils.ts
var SSE_DATA_PREFIX = "data:";
var SSE_EVENT_PREFIX = "event:";
var SSE_COMMENT_PREFIX = ":";
var defaultPort = "8008";
var defaultProtocol = "https";
var defaultDomain = "localhost";
var DEFAULT_OBREW_CONFIG = {
  protocol: defaultProtocol,
  domain: defaultDomain,
  port: defaultPort,
  version: "v1",
  enabled: false
  // Disabled by default until connected
};
var DEFAULT_OBREW_CONNECTION = {
  config: DEFAULT_OBREW_CONFIG,
  api: null
};
var createDomainName = (config) => {
  const { protocol, port, domain } = config;
  const PROTOCOL = protocol || defaultProtocol;
  const PORT = port || defaultPort;
  const DOMAIN = domain === "0.0.0.0" ? defaultDomain : domain || defaultDomain;
  const origin = `${PROTOCOL}://${DOMAIN}:${PORT}`;
  return origin;
};

// src/api.ts
var connect = async ({
  config,
  signal
}) => {
  const options = {
    ...signal && { signal },
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  };
  try {
    const origin = createDomainName(config);
    const res = await fetch(`${origin}/${config.version}/connect`, options);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    if (!res) throw new Error("No response received.");
    return res.json();
  } catch (err) {
    console.error("[obrew] connectToServer error:", err);
    return null;
  }
};
var createServices = (config, response) => {
  if (!response || response.length === 0) return null;
  const serviceApis = {};
  response.forEach((api) => {
    const origin = createDomainName(config);
    const apiName = api.name;
    const endpoints = {};
    let res;
    api.endpoints.forEach((endpoint) => {
      const request = async (args) => {
        try {
          const contentType = { "Content-Type": "application/json" };
          const method = endpoint.method;
          const headers = {
            ...method === "POST" && !args?.formData && contentType
          };
          const body = args?.formData ? args.formData : JSON.stringify(args?.body);
          const signal = args?.signal;
          const queryParams = args?.queryParams ? new URLSearchParams(args?.queryParams).toString() : null;
          const queryUrl = queryParams ? `?${queryParams}` : "";
          const url = `${origin}${endpoint.urlPath}${queryUrl}`;
          res = await fetch(url, {
            method,
            mode: "cors",
            // no-cors, *, cors, same-origin
            cache: "no-cache",
            credentials: "same-origin",
            headers,
            // { 'Content-Type': 'multipart/form-data' }, // Browser will set this automatically for us for "formData"
            redirect: "follow",
            referrerPolicy: "no-referrer",
            // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            ...method !== "GET" && method !== "HEAD" && { body },
            ...signal && { signal }
          });
          if (!res)
            throw new Error(`No response for endpoint ${endpoint.name}.`);
          if (!res?.ok) {
            let errorDetail = res?.statusText;
            try {
              const errorBody = await res.json();
              if (errorBody?.detail) {
                errorDetail = typeof errorBody.detail === "string" ? errorBody.detail : JSON.stringify(errorBody.detail);
              } else if (errorBody?.message) {
                errorDetail = errorBody.message;
              }
            } catch {
            }
            throw new Error(`Something went wrong. ${errorDetail}`);
          }
          const responseType = res.headers.get("content-type");
          if (res.json && !responseType?.includes("event-stream")) {
            const result = await res.json();
            if (!result) throw new Error("Something went wrong");
            if (typeof result?.success === "boolean" && !result?.success)
              throw new Error(
                `An unexpected error occurred for [${endpoint.name}] endpoint: ${result?.message ?? result?.detail}`
              );
            return result;
          }
          return res;
        } catch (err) {
          console.error(`[obrew] Endpoint "${endpoint.name}":`, err);
          return { success: false, message: err };
        }
      };
      endpoints[endpoint.name] = request;
      endpoints.configs = api.configs || {};
    });
    serviceApis[apiName] = endpoints;
  });
  return serviceApis;
};
var fetchAPIConfig = async (config) => {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  };
  try {
    const endpoint = `/${config.version}/services/api`;
    const url = createDomainName(config);
    const res = await fetch(`${url}${endpoint}`, options);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    if (!res) throw new Error(`No response from ${endpoint}`);
    const result = await res.json();
    const success = result?.success;
    if (!success) return null;
    const apis = result.data;
    return apis;
  } catch (err) {
    console.error("[obrew] fetchAPIConfig error:", err);
    return null;
  }
};

// src/client.ts
var LOG_PREFIX = "[obrew-client]";
var ObrewClient = class {
  constructor() {
    this.hasConnected = false;
    this.activeRequests = /* @__PURE__ */ new Map();
    this.connection = DEFAULT_OBREW_CONNECTION;
  }
  // Data Methods //
  /**
   * Check if service is connected
   */
  isConnected() {
    return this.hasConnected && !!this.connection.api && this.connection.config.enabled;
  }
  /**
   * Return the current connection
   */
  getConnection() {
    return this.connection;
  }
  // Connection Methods //
  /**
   * Initialize connection to Obrew backend.
   */
  async connect({
    config,
    signal
  }) {
    if (this.hasConnected) {
      console.log(`${LOG_PREFIX} Connection is already active!`);
      return false;
    }
    try {
      const connSuccess = await connect({
        config,
        ...signal && { signal }
      });
      if (!connSuccess?.success) throw new Error(connSuccess?.message);
      const apiConfig = await fetchAPIConfig(config);
      if (!apiConfig) throw new Error("No api returned.");
      const serviceApis = createServices(config, apiConfig);
      if (serviceApis) {
        this.hasConnected = true;
        const enabledConfig = { ...config, enabled: true };
        this.connection = { config: enabledConfig, api: serviceApis };
        console.log(
          `${LOG_PREFIX} Successfully connected to Obrew API
${config}`
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to connect to Obrew: ${error}`);
      this.hasConnected = false;
      return false;
    }
  }
  /**
   * Ping server to check if it's responsive.
   * Used for server discovery and health checks.
   */
  async ping(timeout = 5e3) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const startTime = performance.now();
    try {
      const connSuccess = await connect({
        config: this.connection.config,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!connSuccess?.success) throw new Error(connSuccess?.message);
      return {
        success: true,
        responseTime: Math.round(performance.now() - startTime)
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed"
      };
    }
  }
  /**
   * Cancel ongoing request(s)
   * @param requestId - Optional specific request ID to cancel. If not provided, cancels all active requests.
   */
  cancelRequest(requestId) {
    if (requestId) {
      const controller = this.activeRequests.get(requestId);
      if (controller) {
        controller.abort();
        this.activeRequests.delete(requestId);
      }
    } else {
      this.activeRequests.forEach((controller) => controller.abort());
      this.activeRequests.clear();
    }
  }
  /**
   * Disconnect from service
   */
  disconnect() {
    this.cancelRequest();
    this.connection.api = null;
    this.hasConnected = false;
  }
  // Core Helper Methods //
  /**
   * Check if an error is a connection/network error
   * If so, mark the client as disconnected
   */
  handlePotentialConnectionError(error) {
    if (error instanceof Error && (error.message.includes("fetch") || error.message.includes("network") || error.message.includes("ECONNREFUSED") || error.message.includes("Failed to fetch") || error.message.includes("NetworkError") || error.message.includes("ERR_CONNECTION"))) {
      console.warn(`${LOG_PREFIX} Connection lost, marking as disconnected`);
      this.hasConnected = false;
    }
  }
  /**
   * Extract text from various response formats
   * Handles multiple response types from different API endpoints
   */
  extractTextFromResponse(response) {
    if (response.text) {
      return response.text;
    }
    if (response.response) {
      return response.response;
    }
    if (response.data && typeof response.data === "string") {
      return response.data;
    }
    if (response.choices && Array.isArray(response.choices)) {
      return response.choices[0]?.text || response.choices[0]?.message?.content || "";
    }
    return String(response);
  }
  /**
   * Unified streaming response handler for SSE (Server-Sent Events)
   * Supports both simple text accumulation and advanced callback-based streaming
   * https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
   * @param response - The Response object containing the stream
   * @param options - Configuration options for handling the stream
   * @param abortRef - Optional external AbortController to cancel the stream (separate from class's abortController)
   */
  async handleStreamResponse(response, options, abortRef) {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No reader available for streaming response");
    }
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    const extractText = options?.extractText ?? true;
    const abortHandler = () => {
      reader.cancel().catch(() => {
      });
    };
    if (abortRef?.signal) {
      abortRef.signal.addEventListener("abort", abortHandler);
    }
    try {
      let readingBuffer = await reader.read();
      while (!readingBuffer.done && !abortRef?.signal.aborted) {
        try {
          const chunk = typeof readingBuffer.value === "string" ? readingBuffer.value : decoder.decode(readingBuffer.value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line?.startsWith(SSE_COMMENT_PREFIX)) {
              const comment = line.slice(SSE_COMMENT_PREFIX.length).trim();
              await options?.onComment?.(comment);
            }
            if (line?.startsWith(SSE_EVENT_PREFIX)) {
              const eventName = line.slice(SSE_EVENT_PREFIX.length).trim();
              await options?.onEvent?.(eventName);
            }
            if (line?.startsWith(SSE_DATA_PREFIX)) {
              const eventData = line.slice(SSE_DATA_PREFIX.length).trim();
              if (eventData === "[DONE]") {
                break;
              }
              await options?.onData?.(eventData);
              if (extractText) {
                try {
                  const parsed = JSON.parse(eventData);
                  fullText += this.extractTextFromResponse(parsed);
                } catch {
                  fullText += eventData;
                }
              }
            }
            if (!line.startsWith(SSE_DATA_PREFIX) && line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              await options?.onData?.(data);
              if (extractText) {
                try {
                  const parsed = JSON.parse(data);
                  fullText += this.extractTextFromResponse(parsed);
                } catch {
                  fullText += data;
                }
              }
            }
          }
        } catch (err) {
          console.log(`${LOG_PREFIX} Error reading stream data buffer: ${err}`);
        }
        readingBuffer = await reader.read();
      }
      if (!readingBuffer.done) {
        await reader.cancel();
      }
    } finally {
      if (abortRef?.signal) {
        abortRef.signal.removeEventListener("abort", abortHandler);
      }
      reader.releaseLock();
    }
    if (!abortRef?.signal.aborted) {
      await options?.onFinish?.();
    }
    return fullText;
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
  async sendMessage(messages, options, setEventState, requestId) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    const reqId = requestId || crypto.randomUUID();
    const abortController = new AbortController();
    this.activeRequests.set(reqId, abortController);
    try {
      const response = await this.connection?.api?.textInference.generate({
        body: {
          messages,
          ...options
        },
        signal: abortController.signal
      });
      if (!response) throw new Error("No response from AI service");
      if (typeof response === "object" && response !== null && "success" in response && response.success === false) {
        throw new Error(`No response from AI service: ${response.message}`);
      }
      if (typeof response === "string") {
        return response;
      }
      if (typeof response === "object" && response !== null && "headers" in response && "body" in response) {
        const httpResponse = response;
        const contentType = httpResponse.headers.get("content-type");
        if (contentType?.includes("event-stream")) {
          return await this.handleStreamResponse(
            httpResponse,
            {
              onData: (res) => {
                console.log(`onData:
${res}`);
              },
              onFinish: async () => {
                console.log(`${LOG_PREFIX} stream finished!`);
                return;
              },
              onEvent: async (str) => {
                this.onStreamEvent(str);
                const displayEventStr = str.replace(/_/g, " ") + "...";
                if (str) setEventState?.(displayEventStr);
              },
              onComment: async (str) => {
                console.log(`${LOG_PREFIX} onComment:
${str}`);
                return;
              },
              extractText: false
              // Don't accumulate text, use callbacks instead
            },
            abortController
          );
        } else {
          const data = await httpResponse.json();
          return this.extractTextFromResponse(data);
        }
      }
      return this.extractTextFromResponse(response);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request was cancelled");
      }
      this.handlePotentialConnectionError(error);
      throw error;
    } finally {
      this.activeRequests.delete(reqId);
    }
  }
  /**
   * Handle streaming events
   */
  onStreamEvent(eventName) {
    console.log(`${LOG_PREFIX} onStreamEvent ${eventName}`);
  }
  stopChat() {
    this.cancelRequest();
    this.connection?.api?.textInference.stop();
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
  async installModel(repoId, filename, mmprojRepoId, mmprojFilename) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const body = { repo_id: repoId };
      if (filename) {
        body.filename = filename;
      }
      if (mmprojRepoId) {
        body.mmproj_repo_id = mmprojRepoId;
      }
      if (mmprojFilename) {
        body.mmproj_filename = mmprojFilename;
      }
      const response = await this.connection?.api?.textInference.download({
        body
      });
      if (response?.success === false) {
        const errorMsg = response?.message || "Unknown error occurred";
        throw new Error(errorMsg);
      }
      if (response?.message) {
        return response.message;
      }
      if (response?.data) {
        return response.data;
      }
      throw new Error("No response data from model installation");
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to install model: ${message}`);
    }
  }
  /**
   * Uninstall/delete a model from server
   * @param repoId - The repository ID of the model to delete
   * @param filename - The filename of the model to delete
   * @throws Error if not connected or deletion fails
   */
  async uninstallModel(repoId, filename) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      await this.connection?.api?.textInference.delete({
        body: {
          repoId,
          filename
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to uninstall model: ${message}`);
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
    modelPath
  }) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const results = await this.connection?.api?.textInference.load({
        body: {
          modelPath,
          modelId,
          init: {
            ...modelSettings.performance
          },
          call: {
            ...modelSettings.response
          },
          raw_input: false,
          // user can send manually formatted messages
          responseMode: modelSettings.attention.response_mode,
          toolUseMode: modelSettings.attention.tool_use_mode
          // toolSchemaType: modelSettings.tools.assigned
          // messages?: [] || null
        }
      });
      if (!results) throw new Error("No results for loaded model.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to load model: ${message}`);
    }
  }
  /**
   * Unload the currently loaded text model
   * @throws Error if not connected or unloading fails
   */
  async unloadModel() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      await this.connection?.api?.textInference.unload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to unload model: ${message}`);
    }
  }
  /**
   * Get currently loaded model info
   * @returns The loaded model data, or null if no model is loaded
   * @throws Error if not connected
   */
  async getLoadedModel() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.textInference.model();
      return response?.data || null;
    } catch (error) {
      console.warn(
        `${LOG_PREFIX} No model currently loaded, backend returned:
${error}`
      );
      return null;
    }
  }
  /**
   * Get list of installed models
   * @returns Array of installed models (empty array if none installed)
   * @throws Error if not connected or request fails
   */
  async getInstalledModels() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.textInference.installed();
      const result = response?.data;
      if (!result || result.length <= 0) return [];
      return result;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to get installed models: ${message}`);
    }
  }
  /**
   * Save agent/bot configuration settings
   * @param config - The agent configuration settings to save
   * @returns Array of all saved agent configurations
   * @throws Error if not connected or save fails
   */
  async saveAgentConfig(config) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.storage?.saveBotSettings({
        body: config
      });
      return response?.data || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to save agent config: ${message}`);
    }
  }
  /**
   * Return the agent/bot configuration settings
   * @param botName - Bot name to filter configurations
   * @returns Array of agent configurations (empty array if none found)
   * @throws Error if not connected or load fails
   */
  async getAgentConfig(botName) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.storage?.getBotSettings({
        ...botName && { queryParams: { botName } }
      });
      const config = response?.data?.find((c) => c.model.botName === botName);
      return config || null;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to get agent config: ${message}`);
    }
  }
  /**
   * Delete agent/bot configuration settings
   * @param botName - The bot name to delete
   * @returns Array of remaining agent configurations
   * @throws Error if not connected or deletion fails
   */
  async deleteAgentConfig(botName) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.storage?.deleteBotSettings({
        queryParams: { botName }
      });
      return response?.data || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to delete agent config: ${message}`);
    }
  }
  /**
   * Get hardware information (GPU details, VRAM, etc.)
   * @returns Array of hardware information (empty array if no hardware found)
   * @throws Error if not connected or audit fails
   */
  async auditHardware() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.textInference.auditHardware();
      const results = response?.data || [];
      console.log(`${LOG_PREFIX} Hardware audit result:`, results);
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to audit hardware: ${message}`);
    }
  }
  /**
   * Wipe all installed models (text, embedding, vision) and clear caches
   * @returns Information about freed space and cleared caches
   * @throws Error if not connected or wipe fails
   */
  async wipeAllModels() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.textInference.wipeModels({});
      if (!response) {
        throw new Error("No response from wipe models");
      }
      if (response.success === false) {
        throw new Error(response.message || "Failed to wipe models");
      }
      console.log(`${LOG_PREFIX} All models wiped:`, response.data);
      return response.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to wipe all models: ${message}`);
    }
  }
  // Embedding Model Methods //
  /**
   * Download an embedding model from HuggingFace
   * @param repoId - The repository ID of the embedding model (e.g., "intfloat/multilingual-e5-large-instruct")
   * @returns Success message with model info
   * @throws Error if not connected or download fails
   */
  async installEmbeddingModel(repoId, filename) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.memory.downloadEmbedModel({
        body: {
          repo_id: repoId,
          filename
        }
      });
      if (response?.success === false) {
        const errorMsg = response?.message || "Unknown error occurred";
        throw new Error(errorMsg);
      }
      if (response?.message) {
        return response.message;
      }
      if (response?.data) {
        return response.data;
      }
      throw new Error("No response data from embedding model download");
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to download embedding model: ${message}`);
    }
  }
  /**
   * Get list of installed embedding models
   * @returns Array of installed embedding models
   * @throws Error if not connected or request fails
   */
  async getInstalledEmbeddingModels() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.memory.installedEmbedModels();
      if (response?.success === false) {
        const errorMsg = response?.message || "Unknown error occurred";
        throw new Error(errorMsg);
      }
      return response?.data || [];
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to get installed embedding models: ${message}`);
    }
  }
  /**
   * Get list of available embedding models for installation
   * @returns Array of available embedding model configurations
   * @throws Error if not connected or request fails
   */
  async getAvailableEmbeddingModels() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.memory.availableEmbedModels();
      return response?.data || [];
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to get available embedding models: ${message}`);
    }
  }
  /**
   * Delete an installed embedding model
   * @param repoId - The repository ID of the embedding model to delete
   * @returns Success message
   * @throws Error if not connected or deletion fails
   */
  async deleteEmbeddingModel(repoId) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.memory.deleteEmbedModel({
        body: {
          repoId
        }
      });
      if (response?.message) {
        return response.message;
      }
      throw new Error("No response from embedding model deletion");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to delete embedding model: ${message}`);
    }
  }
  /**
   * Get information about an embedding model from HuggingFace
   * @param repoId - The repository ID of the embedding model
   * @returns Model information from HuggingFace
   * @throws Error if not connected or request fails
   */
  async getEmbeddingModelInfo(repoId) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.memory.getEmbedModelInfo({
        queryParams: {
          repoId
        }
      });
      return response?.data || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to get embedding model info: ${message}`);
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
  async transcribeImage(images, prompt, options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const defaultPrompt = "Describe this image in detail. Include any visible text, diagrams, charts, or important visual elements.";
      const response = await this.connection?.api?.vision?.generate({
        body: {
          prompt: prompt || defaultPrompt,
          images,
          image_type: "base64",
          stream: false,
          ...options
        }
      });
      if (!response) {
        throw new Error("No response from vision model");
      }
      if (typeof response === "object" && "success" in response && !response.success) {
        throw new Error(
          response.message || "Vision transcription failed"
        );
      }
      console.log(
        "[ObrewClient] Full vision response:",
        JSON.stringify(response, null, 2)
      );
      if (typeof response === "object" && "text" in response) {
        const text = response.text;
        console.log("[ObrewClient] Vision response:", {
          hasText: !!text,
          textLength: text?.length ?? 0,
          responseKeys: Object.keys(response)
        });
        return text;
      }
      console.error(
        "[ObrewClient] Unexpected vision response format:",
        response
      );
      throw new Error("Unexpected response format from vision model");
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to transcribe image: ${message}`);
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
    mmprojPath
  }) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.vision?.load({
        body: {
          modelPath,
          mmprojPath,
          modelId,
          init: modelSettings.init,
          call: modelSettings.call
        }
      });
      if (!response?.success) {
        throw new Error(
          response?.message || "Failed to load vision model"
        );
      }
      console.log(`${LOG_PREFIX} Vision model loaded: ${modelId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to load vision model: ${message}`);
    }
  }
  /**
   * Unload the currently loaded vision model
   * @throws Error if not connected or unloading fails
   */
  async unloadVisionModel() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      await this.connection?.api?.vision?.unload({});
      console.log(`${LOG_PREFIX} Vision model unloaded`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to unload vision model: ${message}`);
    }
  }
  /**
   * Get currently loaded vision model info
   * @returns The loaded vision model data, or null if no model is loaded
   * @throws Error if not connected or request fails
   */
  async getLoadedVisionModel() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.vision?.model({});
      return response?.data || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to get loaded vision model: ${message}`);
    }
  }
  // Vision Embedding Model Methods //
  /**
   * Load a vision embedding model for creating image embeddings
   * @param options - Model loading options including model_path and mmproj_path
   * @returns The loaded model info (name, id)
   * @throws Error if not connected or loading fails
   */
  async loadVisionEmbedModel(options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.vision?.loadEmbedModel({
        body: options
      });
      if (!response) {
        throw new Error("No response from vision embed load");
      }
      if ("success" in response && !response.success) {
        throw new Error(
          response?.message || "Failed to load vision embed model"
        );
      }
      console.log(`${LOG_PREFIX} Vision embed model loaded`);
      return response.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to load vision embed model: ${message}`);
    }
  }
  /**
   * Unload the currently loaded vision embedding model
   * @throws Error if not connected or unloading fails
   */
  async unloadVisionEmbedModel() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      await this.connection?.api?.vision?.unloadEmbedModel({});
      console.log(`${LOG_PREFIX} Vision embed model unloaded`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to unload vision embed model: ${message}`);
    }
  }
  /**
   * Get information about the currently loaded vision embedding model
   * @returns The model info or null if no model is loaded
   * @throws Error if not connected or request fails
   */
  async getVisionEmbedModelInfo() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.vision?.getEmbedModel({});
      if (!response) {
        return null;
      }
      if ("success" in response && !response.success) {
        return null;
      }
      return response.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to get vision embed model info: ${message}`);
    }
  }
  /**
   * Create an embedding for an image
   * @param options - Embedding options including image data and collection info
   * @returns The embedding result with id, collection name, dimension, and optional transcription
   * @throws Error if not connected, no embed model loaded, or embedding fails
   */
  async createImageEmbedding(options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.vision?.embed({
        body: options
      });
      if (!response) {
        throw new Error("No response from vision embed");
      }
      if ("success" in response && !response.success) {
        throw new Error(
          response?.message || "Failed to create image embedding"
        );
      }
      console.log(`${LOG_PREFIX} Image embedding created:`, response.data);
      return response.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to create image embedding: ${message}`);
    }
  }
  /**
   * Query an image collection using text similarity search
   * @param options - Query options including query text, collection name, and optional top_k
   * @returns The query results with matching images, similarity scores, and metadata
   * @throws Error if not connected, collection not found, or query fails
   */
  async queryImageCollection(options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.vision?.queryImages({
        body: options
      });
      if (!response) {
        throw new Error("No response from image query");
      }
      if ("success" in response && !response.success) {
        throw new Error(
          response?.message || "Failed to query image collection"
        );
      }
      console.log(
        `${LOG_PREFIX} Image query returned ${response.data?.results?.length ?? 0} results`
      );
      return response.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to query image collection: ${message}`);
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
  async installVisionEmbedModel(repoId, filename, mmprojFilename) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.vision?.downloadEmbedModel({
        body: {
          repo_id: repoId,
          filename,
          mmproj_filename: mmprojFilename
        }
      });
      if (!response) {
        throw new Error("No response from vision embed download");
      }
      if ("success" in response && !response.success) {
        throw new Error(
          response.message || "Failed to download vision embed model"
        );
      }
      console.log(`${LOG_PREFIX} Vision embed model downloaded:`, response.data);
      return response.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to download vision embed model: ${message}`);
    }
  }
  /**
   * Delete a vision embedding model (GGUF + mmproj)
   * @param repoId - The repository ID of the vision embed model to delete
   * @throws Error if not connected or deletion fails
   */
  async deleteVisionEmbedModel(repoId) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.vision?.deleteEmbedModel({
        body: {
          repo_id: repoId
        }
      });
      if (!response) {
        throw new Error("No response from vision embed delete");
      }
      if ("success" in response && !response.success) {
        throw new Error(
          response.message || "Failed to delete vision embed model"
        );
      }
      console.log(`${LOG_PREFIX} Vision embed model deleted: ${repoId}`);
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to delete vision embed model: ${message}`);
    }
  }
  /**
   * Get list of installed vision embedding models
   * @returns Array of installed vision embedding model metadata
   * @throws Error if not connected or request fails
   */
  async getInstalledVisionEmbedModels() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.vision?.installedEmbedModels(
        {}
      );
      if (!response) {
        throw new Error("No response from vision embed installed models");
      }
      if ("success" in response && !response.success) {
        throw new Error(
          response.message || "Failed to get installed vision embed models"
        );
      }
      const models = response.data || [];
      console.log(
        `${LOG_PREFIX} Found ${models.length} installed vision embed models`
      );
      return models;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to get installed vision embed models: ${message}`);
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
  async startDownload(options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    const { modelType, repoId, filename, mmprojRepoId, mmprojFilename } = options;
    try {
      let response;
      let taskId = null;
      let mmprojTaskId = null;
      switch (modelType) {
        case "text": {
          const body = { repo_id: repoId };
          if (filename) body.filename = filename;
          if (mmprojRepoId) body.mmproj_repo_id = mmprojRepoId;
          if (mmprojFilename) body.mmproj_filename = mmprojFilename;
          response = await this.connection?.api?.textInference.download({
            body
          });
          taskId = response?.data?.taskId || null;
          mmprojTaskId = response?.data?.mmprojTaskId || null;
          break;
        }
        case "embedding": {
          response = await this.connection?.api?.memory.downloadEmbedModel({
            body: {
              repo_id: repoId,
              filename: filename || ""
            }
          });
          taskId = response?.data?.taskId || null;
          mmprojTaskId = response?.data?.mmprojTaskId || null;
          break;
        }
        case "vision-embedding": {
          response = await this.connection?.api?.vision?.downloadEmbedModel({
            body: {
              repo_id: repoId,
              filename: filename || "",
              mmproj_filename: mmprojFilename || ""
            }
          });
          taskId = response?.data?.taskId || null;
          mmprojTaskId = response?.data?.mmprojTaskId || null;
          break;
        }
      }
      if (response?.success === false) {
        throw new Error(response?.message || "Failed to start download");
      }
      console.log(
        `${LOG_PREFIX} Download ${taskId ? `started with taskId: ${taskId}` : "completed synchronously"}${mmprojTaskId ? ` (mmproj: ${mmprojTaskId})` : ""}`
      );
      return { taskId, mmprojTaskId };
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to start download: ${message}`);
    }
  }
  /**
   * Subscribe to download progress via SSE
   * Uses the centralized /v1/downloads/progress endpoint (works for all model types)
   * @param taskId - The task ID from startModelDownload/startEmbeddingModelDownload/startVisionEmbedModelDownload
   * @param callbacks - Progress callbacks
   * @returns AbortController to cancel the subscription
   */
  subscribeToDownloadProgress(taskId, callbacks) {
    const abortController = new AbortController();
    this.startDownloadProgressStream(taskId, abortController, callbacks);
    return abortController;
  }
  /**
   * Internal method to start the SSE progress stream using API service pattern
   */
  async startDownloadProgressStream(taskId, abortController, callbacks) {
    try {
      const response = await this.connection?.api?.downloads.progress({
        queryParams: { task_id: taskId },
        signal: abortController.signal
      });
      if (!response) {
        callbacks.onError?.("No response from progress endpoint");
        return;
      }
      await this.streamDownloadProgress(response, abortController, callbacks);
    } catch (error) {
      if (error.name === "AbortError") {
        callbacks.onCancel?.();
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        callbacks.onError?.(message);
      }
    }
  }
  /**
   * Internal method to stream download progress via SSE
   * @param response - The Response object from the API service
   */
  async streamDownloadProgress(response, abortController, callbacks) {
    try {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available for SSE response");
      }
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done || abortController.signal.aborted) {
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                callbacks.onError?.(data.error);
                return;
              }
              const progress = {
                primaryTaskId: data.task_id,
                secondaryTaskId: data.secondary_task_id || null,
                status: data.status || "unknown",
                primaryFileDone: data.primary_file_done ?? null,
                secondaryFileDone: data.secondary_file_done ?? null,
                // Map primary_progress object
                primaryProgress: {
                  downloadedBytes: data.primary_progress?.downloaded_bytes || 0,
                  totalBytes: data.primary_progress?.total_bytes || 0,
                  percent: data.primary_progress?.percent || 0,
                  speedMbps: data.primary_progress?.speed_mbps || 0,
                  etaSeconds: data.primary_progress?.eta_seconds ?? null,
                  status: data.primary_progress?.status || "unknown"
                },
                // Map secondary_progress object if present
                secondaryProgress: data.secondary_progress ? {
                  downloadedBytes: data.secondary_progress.downloaded_bytes || 0,
                  totalBytes: data.secondary_progress.total_bytes || 0,
                  percent: data.secondary_progress.percent || 0,
                  speedMbps: data.secondary_progress.speed_mbps || 0,
                  etaSeconds: data.secondary_progress.eta_seconds,
                  status: data.secondary_progress.status || "unknown"
                } : null
              };
              callbacks.onProgress?.(progress);
              if (data.status === "completed") {
                callbacks.onComplete?.(data.file_path);
                return;
              } else if (data.status === "error") {
                callbacks.onError?.(data.error || "Download failed");
                return;
              } else if (data.status === "cancelled") {
                callbacks.onCancel?.();
                return;
              }
            } catch {
            }
          }
        }
      }
    } catch (error) {
      if (error.name === "AbortError") {
        callbacks.onCancel?.();
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        callbacks.onError?.(message);
      }
    }
  }
  /**
   * Cancel an in-progress download
   * Uses the centralized /v1/downloads endpoint (works for all model types)
   * @param taskId - The task ID to cancel
   */
  async cancelDownload(taskId) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.downloads.cancel({
        queryParams: { task_id: taskId }
      });
      if (response?.success === false) {
        throw new Error(response?.message || "Failed to cancel download");
      }
      console.log(`${LOG_PREFIX} Download cancelled: ${taskId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to cancel download: ${message}`);
    }
  }
  // ============================================================================
  // Search Methods
  // ============================================================================
  /**
   * Perform a vector/embedding search across ChromaDB collections
   * @param options - Vector search options
   * @returns Search results with relevance scores
   * @throws Error if not connected or search fails
   */
  async vectorSearch(options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.search.vector({
        body: options
      });
      if (response?.success === false) {
        throw new Error(response?.message || "Vector search failed");
      }
      return response?.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to perform vector search: ${message}`);
    }
  }
  /**
   * Perform a web search using DuckDuckGo
   * @param options - Web search options
   * @returns Web search results
   * @throws Error if not connected or search fails
   */
  async webSearch(options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.search.web({
        body: options
      });
      if (response?.success === false) {
        throw new Error(response?.message || "Web search failed");
      }
      return response?.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to perform web search: ${message}`);
    }
  }
  /**
   * Perform a file system search
   * @param options - File system search options
   * @returns File search results
   * @throws Error if not connected or search fails
   */
  async fileSystemSearch(options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.search.fs({
        body: options
      });
      if (response?.success === false) {
        throw new Error(response?.message || "File system search failed");
      }
      return response?.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to perform file system search: ${message}`);
    }
  }
  /**
   * Perform a structured data search on ephemeral data
   * @param options - Structured search options with items to search
   * @returns Search results
   * @throws Error if not connected or search fails
   */
  async structuredSearch(options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.search.structured({
        body: options
      });
      if (response?.success === false) {
        throw new Error(response?.message || "Structured search failed");
      }
      return response?.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to perform structured search: ${message}`);
    }
  }
  /**
   * Perform an agentic email search on email data from MS Graph API
   * @param options - Email search options with raw email objects
   * @returns Search results
   * @throws Error if not connected or search fails
   */
  async emailSearch(options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.search.email({
        body: options
      });
      if (response?.success === false) {
        throw new Error(response?.message || "Email search failed");
      }
      return response?.data;
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to perform email search: ${message}`);
    }
  }
  /**
   * Stop a running search by ID or stop all searches
   * @param searchId - Optional search ID to stop (stops all if omitted)
   * @throws Error if not connected or stop fails
   */
  async stopSearch(searchId) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.search.stop({
        body: { search_id: searchId }
      });
      if (response?.success === false) {
        throw new Error(response?.message || "Failed to stop search");
      }
      console.log(`${LOG_PREFIX} Search stopped: ${searchId || "all searches"}`);
    } catch (error) {
      this.handlePotentialConnectionError(error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to stop search: ${message}`);
    }
  }
};
var obrewClient = new ObrewClient();

// src/types.ts
var ModelID = /* @__PURE__ */ ((ModelID2) => {
  ModelID2["GPT3"] = "gpt3.5";
  ModelID2["GPT4"] = "gpt4";
  ModelID2["GPTNeo"] = "gpt-neoxt-20B";
  ModelID2["Cohere"] = "xlarge";
  ModelID2["Local"] = "local";
  return ModelID2;
})(ModelID || {});
var DEFAULT_CONVERSATION_MODE = "instruct";
var DEFAULT_TOOL_RESPONSE_MODE = "answer";
var TOOL_RESPONSE_MODE_RESULT = "result";
var BASE_RETRIEVAL_METHOD = "base";
var AUGMENTED_RETRIEVAL_METHOD = "augmented";
var AGENT_RETRIEVAL_METHOD = "agent";
var DEFAULT_RETRIEVAL_METHOD = BASE_RETRIEVAL_METHOD;
var NATIVE_TOOL_USE = "native";
var UNIVERSAL_TOOL_USE = "universal";
var DEFAULT_TOOL_USE_MODE = UNIVERSAL_TOOL_USE;

export { AGENT_RETRIEVAL_METHOD, AUGMENTED_RETRIEVAL_METHOD, BASE_RETRIEVAL_METHOD, DEFAULT_CONVERSATION_MODE, DEFAULT_OBREW_CONFIG, DEFAULT_RETRIEVAL_METHOD, DEFAULT_TOOL_RESPONSE_MODE, DEFAULT_TOOL_USE_MODE, ModelID, NATIVE_TOOL_USE, TOOL_RESPONSE_MODE_RESULT, UNIVERSAL_TOOL_USE, obrewClient as client };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map