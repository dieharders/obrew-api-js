/**
 * Core API client for Obrew backend services
 * @module api
 */

import { createDomainName } from "./utils";
import type {
  I_API,
  I_ConnectResponse,
  I_ServicesResponse,
  I_ServiceApis,
  I_GenericAPIRequestParams,
  T_GenericReqPayload,
  T_APIConfigOptions,
} from "./types";

/**
 * Connect to the Obrew backend server
 * @returns A promise that resolves with connection info or null on failure
 */
export const fetchConnect = async (): Promise<I_ConnectResponse | null> => {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
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

/**
 * Fetch the API configuration from the backend
 * @returns A promise that resolves with the API configuration or null on failure
 */
export const fetchAPIConfig = async (): Promise<I_ServicesResponse | null> => {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
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

/**
 * Create service API clients from backend configuration
 * @param response - The API configuration from the backend
 * @returns Service API clients or null if configuration is invalid
 */
export const createServices = (
  response: I_API[] | null
): I_ServiceApis | null => {
  if (!response || response.length === 0) return null;

  const serviceApis = {} as I_ServiceApis;

  // Construct api funcs for each service
  response.forEach((api) => {
    const origin = `${createDomainName()}`;
    const apiName = api.name;
    const endpoints: {
      [key: string]: (args: any) => Promise<Response | null>;
    } & {
      configs?: T_APIConfigOptions;
    } = {};
    let res: Response;

    // Parse endpoint urls
    api.endpoints.forEach((endpoint) => {
      // Create a curried fetch function
      const request = async (
        args: I_GenericAPIRequestParams<T_GenericReqPayload>
      ) => {
        try {
          const contentType = { "Content-Type": "application/json" };
          const method = endpoint.method;
          const headers = {
            ...(method === "POST" && !args?.formData && contentType),
          };
          const body = args?.formData
            ? args.formData
            : JSON.stringify(args?.body);
          const signal = args?.signal;
          const queryParams = args?.queryParams
            ? new URLSearchParams(args?.queryParams).toString()
            : null;
          const queryUrl = queryParams ? `?${queryParams}` : "";
          const url = `${origin}${endpoint.urlPath}${queryUrl}`;

          res = await fetch(url, {
            method,
            mode: "cors", // no-cors, *, cors, same-origin
            cache: "no-cache",
            credentials: "same-origin",
            headers, // { 'Content-Type': 'multipart/form-data' }, // Browser will set this automatically for us for "formData"
            redirect: "follow",
            referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body,
            ...(signal && { signal }),
          });

          // Check no response
          if (!res)
            throw new Error(`No response for endpoint ${endpoint.name}.`);

          // Check bad request
          if (!res?.ok)
            throw new Error(`Something went wrong. ${res?.statusText}`);

          // Check json response
          const responseType = res.headers.get("content-type");
          if (res.json && !responseType?.includes("event-stream")) {
            const result = await res.json();

            if (!result) throw new Error("Something went wrong");
            // Check failure from obrew api
            if (typeof result?.success === "boolean" && !result?.success)
              throw new Error(
                `An unexpected error occurred for [${
                  endpoint.name
                }] endpoint: ${result?.message ?? result?.detail}`
              );
            // Success
            return result;
          }
          // Return raw response (for streaming)
          return res;
        } catch (err) {
          console.error(`[obrew] Endpoint "${endpoint.name}":`, err);
          return { success: false, message: err };
        }
      };

      // Add request function for this endpoint
      endpoints[endpoint.name] = request;
      // Set api configs
      endpoints.configs = api.configs || {};
    });
    // Set api callbacks
    serviceApis[apiName] = endpoints;
  });

  return serviceApis;
};

/**
 * Connect to the local Obrew provider
 * @returns A promise that resolves with connection info or null on failure
 */
export const connectToLocalProvider =
  async (): Promise<I_ConnectResponse | null> => {
    const conn = await fetchConnect();
    console.log("[obrew] Connecting:", conn);

    const connected = conn?.success;
    if (!connected) return null;

    console.log(`[obrew] Connected to local ai engine: ${conn.message}`);
    return conn;
  };

/**
 * Get the API configuration from the backend
 * @returns A promise that resolves with the API array or null on failure
 */
export const getAPIConfig = async () => {
  const config = await fetchAPIConfig();
  console.log("[obrew] getAPIConfig:", config);

  const success = config?.success;
  if (!success) return null;

  const apis = config.data;
  return apis;
};
