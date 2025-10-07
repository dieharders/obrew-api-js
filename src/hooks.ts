/**
 * React hooks for Obrew API
 * @module hooks
 */

import { useCallback } from "react";
import { getAPIConfig, createServices, connectToLocalProvider } from "./api";
import type {
  I_ServiceApis,
  I_ConnectResponse,
  T_APIConfigOptions,
} from "./types";

/**
 * Service APIs with configuration options
 */
export interface ServicesWithConfig {
  serviceApis: I_ServiceApis | null;
  configOptions: T_APIConfigOptions;
}

/**
 * Hook for Obrew API that handles state and connections
 * @returns Object containing connect and getServices methods
 *
 * @example
 * ```tsx
 * import { useObrew } from 'obrew-api-js'
 *
 * function MyComponent() {
 *   const { connect, getServices } = useObrew()
 *
 *   useEffect(() => {
 *     async function init() {
 *       const connection = await connect()
 *       if (connection?.success) {
 *         const services = await getServices()
 *         // Use services.textInference, services.memory, etc.
 *       }
 *     }
 *     init()
 *   }, [connect, getServices])
 *
 *   return <div>My App</div>
 * }
 * ```
 */
export const useObrew = () => {
  /**
   * Get all API configs for services
   * @returns Service APIs with their configuration options
   */
  const getServices = useCallback(async (): Promise<ServicesWithConfig> => {
    const res = await getAPIConfig();

    // Store all config options for endpoints
    let configOptions: T_APIConfigOptions = {};
    res?.forEach((i) => {
      if (i.configs) configOptions = { ...configOptions, ...i.configs };
    });

    // Return readily usable request funcs
    const serviceApis = createServices(res);

    return { serviceApis, configOptions };
  }, []);

  /**
   * Attempt to connect to Obrew API
   * @returns Connection result or null on failure
   */
  const connect = useCallback(async (): Promise<I_ConnectResponse | null> => {
    const result = await connectToLocalProvider();
    if (!result?.success) return null;

    // Attempt to return api services
    await getServices();

    return result;
  }, [getServices]);

  return {
    connect,
    getServices,
  };
};

/**
 * @deprecated Use useObrew instead. This is kept for backwards compatibility.
 */
export const useHomebrew = useObrew;
