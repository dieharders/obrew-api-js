/**
 * Obrew API - TypeScript client library for Obrew backend services
 *
 * @packageDocumentation
 *
 * This library provides a type-safe client for interacting with Obrew AI backend services.
 * It includes React hooks for easy integration with React applications, as well as
 * standalone API functions for use in any TypeScript/JavaScript project.
 *
 * @example
 * ```ts
 * import { client } from 'obrew-api-js'
 *
 * // Connect to the Obrew backend
 * const connected = await client.connect({
 *   domain: 'http://localhost',
 *   port: '8008'
 * })
 *
 * if (connected) {
 *   // Send a message to the AI
 *   const response = await client.sendMessage([
 *     { role: 'user', content: 'Hello!' }
 *   ])
 *
 *   console.log(response)
 * }
 *
 * // When done, disconnect
 * client.disconnect()
 * ```
 */

// ============================================================================
// Core API Functions
// ============================================================================

export { obrewClient as client } from './client'

// ============================================================================
// Utility Functions
// ============================================================================

export { DEFAULT_OBREW_CONFIG } from './utils'

// ============================================================================
// Type Exports - Message & Thread Types
// ============================================================================

export type { Message, I_Message, I_Thread } from './types'

// ============================================================================
// Type Exports - Model Types
// ============================================================================

export { ModelID } from './types'

export type {
  T_ModelConfig,
  I_ModelConfigs,
  T_InstalledTextModel,
} from './types'

// ============================================================================
// Type Exports - LLM Configuration Types
// ============================================================================

export type {
  I_LLM_Init_Options,
  I_Response_State,
  I_LLM_Call_Options,
  I_LLM_Options,
} from './types'

// ============================================================================
// Type Exports - Conversation & Inference Types
// ============================================================================

export {
  DEFAULT_CONVERSATION_MODE,
  DEFAULT_TOOL_RESPONSE_MODE,
  BASE_RETRIEVAL_METHOD,
  AUGMENTED_RETRIEVAL_METHOD,
  AGENT_RETRIEVAL_METHOD,
  DEFAULT_RETRIEVAL_METHOD,
  NATIVE_TOOL_USE,
  UNIVERSAL_TOOL_USE,
  DEFAULT_TOOL_USE_MODE,
} from './types'

export type {
  T_ConversationMode,
  T_ToolResponseMode,
  T_ToolUseMode,
  T_ToolSchemaType,
  I_InferenceGenerateOptions,
  T_LLM_InferenceOptions,
  I_LoadTextModelRequestPayload,
  I_LoadedModelRes,
} from './types'

// ============================================================================
// Type Exports - Response Types
// ============================================================================

export type {
  I_NonStreamChatbotResponse,
  I_NonStreamPlayground,
  I_GenericAPIResponse,
} from './types'

// ============================================================================
// Type Exports - Request Types
// ============================================================================

export type {
  T_GenericDataRes,
  T_GenericReqPayload,
  I_GenericAPIRequestParams,
  T_GenericAPIRequest,
  T_SaveChatThreadAPIRequest,
  T_GetChatThreadAPIRequest,
  T_DeleteChatThreadAPIRequest,
} from './types'

// ============================================================================
// Type Exports - Knowledge & Memory Types
// ============================================================================

export type {
  I_Knowledge_State,
  I_RAG_Strat_State,
  I_ChunkMetadata,
  I_Source,
  I_DocumentChunk,
  I_Collection,
} from './types'

// ============================================================================
// Type Exports - Tool Types
// ============================================================================

export type {
  T_InputOptionTypes,
  T_Tool_Param_Option,
  I_Tool_Parameter,
  I_Tool_Def_Parameter,
  I_ToolFunctionSchemaRes,
  I_Tool_Definition,
} from './types'

// ============================================================================
// Type Exports - Settings Types
// ============================================================================

export type {
  T_PromptTemplate,
  T_SystemPrompt,
  I_PromptTemplates,
  T_SystemPrompts,
  I_Prompt_State,
  I_Model_State,
  I_System_State,
  I_Attention_State,
  I_Tools_Inference_State,
  I_Text_Settings,
} from './types'

// ============================================================================
// Type Exports - API Configuration Types
// ============================================================================

export type {
  T_APIConfigOptions,
  I_Endpoint,
  I_API,
  I_ServicesResponse,
  I_ConnectResponse,
  I_ConnectionConfig,
  I_Connection,
} from './types'

// ============================================================================
// Type Exports - Service API Types
// ============================================================================

export type {
  T_Endpoint,
  I_BaseServiceApis,
  T_TextInferenceAPIRequest,
  I_DeleteTextModelReqPayload,
  I_ToolSchemaReqPayload,
  I_ServiceApis,
} from './types'
