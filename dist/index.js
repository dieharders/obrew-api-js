'use strict';

// src/utils.ts
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
var connect = async ({ config, signal }) => {
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
            body,
            ...signal && { signal }
          });
          if (!res)
            throw new Error(`No response for endpoint ${endpoint.name}.`);
          if (!res?.ok)
            throw new Error(`Something went wrong. ${res?.statusText}`);
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
    const endpoint = "/${config.version}/services/api";
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
  async connect({ config, signal }) {
    if (this.hasConnected) {
      console.log("[obrew] Connection is already active!");
      return false;
    }
    try {
      const connSuccess = await connect({ config, ...signal && { signal } });
      if (!connSuccess?.success) throw new Error(connSuccess?.message);
      const apiConfig = await fetchAPIConfig(config);
      if (!apiConfig) throw new Error("No api returned.");
      const serviceApis = createServices(config, apiConfig);
      if (serviceApis) {
        this.hasConnected = true;
        console.log("[obrew] Successfully connected to Obrew API");
        this.connection = { config, api: serviceApis };
        return true;
      }
      return false;
    } catch (error) {
      console.error("[obrew] Failed to connect to Obrew:", error);
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
      const connSuccess = await connect({ config: this.connection.config, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!connSuccess?.success) throw new Error(connSuccess?.message);
      return { success: true, responseTime: Math.round(performance.now() - startTime) };
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
  // Core API Helper Methods //
  /**
   * Handle streaming response from AI
   */
  async handleStreamingResponse(response) {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No reader available for streaming response");
    }
    const decoder = new TextDecoder();
    let fullText = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              fullText += this.extractTextFromResponse(parsed);
            } catch (e) {
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return fullText;
  }
  /**
   * Extract text from various response formats
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
   * Send a message and get AI response
   * Handles both streaming and non-streaming responses
   */
  async sendMessage(messages, options) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    this.abortController = new AbortController();
    try {
      const response = await this.connection?.api?.textInference.generate({
        body: {
          messages,
          responseMode: "chat",
          temperature: 0.7,
          max_tokens: 2048,
          stream: false,
          // @TODO Non-streaming for now
          ...options
        },
        signal: this.abortController.signal
      });
      if (!response) {
        throw new Error("No response from AI service");
      }
      if (typeof response === "string") {
        return response;
      }
      if (typeof response === "object" && response !== null && "headers" in response && "body" in response) {
        const httpResponse = response;
        const contentType = httpResponse.headers.get("content-type");
        if (contentType?.includes("event-stream")) {
          return await this.handleStreamingResponse(httpResponse);
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
   * Load a text model
   */
  async loadModel(modelPath, modelId) {
    if (!this.isConnected()) {
      throw new Error("Not connected to Obrew service");
    }
    try {
      await this.connection?.api?.textInference.load({
        body: {
          modelPath,
          modelId,
          init: {
            n_ctx: 4096,
            n_threads: 4,
            n_gpu_layers: -1
          },
          call: {
            temperature: 0.7,
            max_tokens: 2048
          }
        }
      });
      return true;
    } catch (error) {
      console.error("Failed to load model:", error);
      return false;
    }
  }
  /**
   * Get currently loaded model info
   */
  async getLoadedModel() {
    if (!this.isConnected()) {
      return null;
    }
    try {
      const response = await this.connection?.api?.textInference.model();
      return response?.data || null;
    } catch (error) {
      console.error("Failed to get loaded model:", error);
      return null;
    }
  }
  /**
   * Get list of installed models
   */
  async getInstalledModels() {
    if (!this.isConnected()) {
      return [];
    }
    try {
      const response = await this.connection?.api?.textInference.installed();
      return response?.data || [];
    } catch (error) {
      console.error("Failed to get installed models:", error);
      return [];
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
exports.UNIVERSAL_TOOL_USE = UNIVERSAL_TOOL_USE;
exports.client = obrewClient;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map