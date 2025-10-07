'use strict';

var react = require('react');

// src/utils.ts
var CONNECTION_KEY = "remote_host";
var getHostConnection = () => {
  if (typeof localStorage === "undefined") return {};
  const data = localStorage.getItem(CONNECTION_KEY);
  const config = data ? JSON.parse(data) : {};
  return config;
};
var setHostConnection = (newConnection) => {
  if (typeof localStorage === "undefined") return;
  const setting = JSON.stringify(newConnection);
  localStorage.setItem(CONNECTION_KEY, setting);
};
var defaultPort = "8008";
var defaultDomain = "http://localhost";
var createDomainName = () => {
  const { port, domain } = getHostConnection();
  const PORT = port || defaultPort;
  const DOMAIN = domain === "0.0.0.0" ? defaultDomain : domain || defaultDomain;
  const origin = `${DOMAIN}:${PORT}`;
  return origin;
};

// src/api.ts
var fetchConnect = async () => {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  };
  try {
    const domain = createDomainName();
    const res = await fetch(`${domain}/v1/connect`, options);
    if (!res.ok) throw new Error(`[obrew] HTTP error! Status: ${res.status}`);
    if (!res) throw new Error("[obrew] No response received.");
    return res.json();
  } catch (err) {
    console.error("[obrew] connectToServer error:", err);
    return null;
  }
};
var fetchAPIConfig = async () => {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  };
  try {
    const endpoint = "/v1/services/api";
    const domain = createDomainName();
    const res = await fetch(`${domain}${endpoint}`, options);
    if (!res.ok) throw new Error(`[obrew] HTTP error! Status: ${res.status}`);
    if (!res) throw new Error(`[obrew] No response from ${endpoint}`);
    return res.json();
  } catch (err) {
    console.error("[obrew] fetchAPIConfig error:", err);
    return null;
  }
};
var createServices = (response) => {
  if (!response || response.length === 0) return null;
  const serviceApis = {};
  response.forEach((api) => {
    const origin = `${createDomainName()}`;
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
var connectToLocalProvider = async () => {
  const conn = await fetchConnect();
  console.log("[obrew] Connecting:", conn);
  const connected = conn?.success;
  if (!connected) return null;
  console.log(`[obrew] Connected to local ai engine: ${conn.message}`);
  return conn;
};
var getAPIConfig = async () => {
  const config = await fetchAPIConfig();
  console.log("[obrew] getAPIConfig:", config);
  const success = config?.success;
  if (!success) return null;
  const apis = config.data;
  return apis;
};
var useObrew = () => {
  const getServices = react.useCallback(async () => {
    const res = await getAPIConfig();
    let configOptions = {};
    res?.forEach((i) => {
      if (i.configs) configOptions = { ...configOptions, ...i.configs };
    });
    const serviceApis = createServices(res);
    return { serviceApis, configOptions };
  }, []);
  const connect = react.useCallback(async () => {
    const result = await connectToLocalProvider();
    if (!result?.success) return null;
    await getServices();
    return result;
  }, [getServices]);
  return {
    connect,
    getServices
  };
};
var useHomebrew = useObrew;

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
exports.DEFAULT_RETRIEVAL_METHOD = DEFAULT_RETRIEVAL_METHOD;
exports.DEFAULT_TOOL_RESPONSE_MODE = DEFAULT_TOOL_RESPONSE_MODE;
exports.DEFAULT_TOOL_USE_MODE = DEFAULT_TOOL_USE_MODE;
exports.ModelID = ModelID;
exports.NATIVE_TOOL_USE = NATIVE_TOOL_USE;
exports.UNIVERSAL_TOOL_USE = UNIVERSAL_TOOL_USE;
exports.connectToLocalProvider = connectToLocalProvider;
exports.createDomainName = createDomainName;
exports.createServices = createServices;
exports.defaultDomain = defaultDomain;
exports.defaultPort = defaultPort;
exports.fetchAPIConfig = fetchAPIConfig;
exports.fetchConnect = fetchConnect;
exports.getAPIConfig = getAPIConfig;
exports.getHostConnection = getHostConnection;
exports.setHostConnection = setHostConnection;
exports.useHomebrew = useHomebrew;
exports.useObrew = useObrew;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map