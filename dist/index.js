'use strict';

// src/utils.ts
var SSE_DATA_PREFIX = "data:";
var SSE_EVENT_PREFIX = "event:";
var SSE_COMMENT_PREFIX = ":";
var defaultPort = "8008";
var defaultDomain = "http://localhost";
var DEFAULT_OBREW_CONFIG = {
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
  const { port, domain } = config;
  const PORT = port || defaultPort;
  const DOMAIN = domain === "0.0.0.0" ? defaultDomain : domain || defaultDomain;
  const origin = `${DOMAIN}:${PORT}`;
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
    this.abortController = null;
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
   * Cancel ongoing request
   */
  cancelRequest() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
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
      reader.releaseLock();
    }
    await options?.onFinish?.();
    return fullText;
  }
  // Core API Methods //
  /**
   * Send a message and get AI response
   * Handles both streaming and non-streaming responses
   */
  async sendMessage(messages, options, setEventState) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    this.abortController = new AbortController();
    try {
      const response = await this.connection?.api?.textInference.generate({
        body: {
          messages,
          ...options
        },
        signal: this.abortController.signal
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
            this.abortController
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
      throw error;
    }
  }
  /**
   * Handle streaming events
   */
  onStreamEvent(eventName) {
    console.log(`${LOG_PREFIX} onStreamEvent ${eventName}`);
  }
  stopChat() {
    this.abortController?.abort();
    this.connection?.api?.textInference.stop();
  }
  /**
   * Install/download a model from a repository
   * @param repoId - The repository ID of the model to install (e.g., "TheBloke/Mistral-7B-Instruct-v0.2-GGUF")
   * @param filename - Optional specific filename to download from the repository
   * @returns The download result message
   * @throws Error if not connected or download fails
   */
  async installModel(repoId, filename) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const body = { repo_id: repoId };
      if (filename) {
        body.filename = filename;
      }
      const response = await this.connection?.api?.textInference.download({
        body
      });
      if (response?.message) {
        return response.message;
      }
      if (response?.data) {
        return response.data;
      }
      throw new Error("No response data from model installation");
    } catch (error) {
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
    modelPath,
    modelId,
    modelSettings
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
   * @throws Error if not connected or request fails
   */
  async getLoadedModel() {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      const response = await this.connection?.api?.textInference.model();
      return response?.data || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      throw new Error(`Failed to get loaded model: ${message}`);
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
      if (!result || result.length <= 0) throw new Error("No results.");
      return result;
    } catch (error) {
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

exports.AGENT_RETRIEVAL_METHOD = AGENT_RETRIEVAL_METHOD;
exports.AUGMENTED_RETRIEVAL_METHOD = AUGMENTED_RETRIEVAL_METHOD;
exports.BASE_RETRIEVAL_METHOD = BASE_RETRIEVAL_METHOD;
exports.DEFAULT_CONVERSATION_MODE = DEFAULT_CONVERSATION_MODE;
exports.DEFAULT_OBREW_CONFIG = DEFAULT_OBREW_CONFIG;
exports.DEFAULT_RETRIEVAL_METHOD = DEFAULT_RETRIEVAL_METHOD;
exports.DEFAULT_TOOL_RESPONSE_MODE = DEFAULT_TOOL_RESPONSE_MODE;
exports.DEFAULT_TOOL_USE_MODE = DEFAULT_TOOL_USE_MODE;
exports.ModelID = ModelID;
exports.NATIVE_TOOL_USE = NATIVE_TOOL_USE;
exports.TOOL_RESPONSE_MODE_RESULT = TOOL_RESPONSE_MODE_RESULT;
exports.UNIVERSAL_TOOL_USE = UNIVERSAL_TOOL_USE;
exports.client = obrewClient;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map