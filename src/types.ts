/**
 * Type definitions for Obrew API
 * @module types
 */

// ============================================================================
// Message & Thread Types
// ============================================================================

export type Message = {
  id: string
  createdAt?: Date | undefined
  content: string
  role: 'system' | 'user' | 'assistant'
}

export interface I_Message {
  id: string
  content: string
  role: 'system' | 'user' | 'assistant'
  createdAt?: string
  modelId?: string // for assistant msg
  username?: string // for user msg
}

export interface I_Thread {
  id: string
  userId: string
  createdAt: string
  title: string
  summary: string
  numMessages: number
  messages: Array<I_Message>
  sharePath?: string
}

// ============================================================================
// Model Types
// ============================================================================

export enum ModelID {
  GPT3 = 'gpt3.5',
  GPT4 = 'gpt4',
  GPTNeo = 'gpt-neoxt-20B', // together/
  Cohere = 'xlarge', // cohere/
  Local = 'local', // 3rd party, local server
}

export type T_ModelConfig = {
  repoId: string
  name: string
  description?: string
  messageFormat?: string
}

export interface I_ModelConfigs {
  [key: string]: T_ModelConfig
}

export type T_InstalledTextModel = {
  repoId: string
  savePath: { [key: string]: string }
  mmprojPath?: string // Path to mmproj file for vision-capable models
  numTimesRun: number
  isFavorited: boolean
  validation: string
  modified: string
  size: number
  endChunk: number
  progress: number
  tokenizerPath: string
  checksum: string
}

export type T_EmbeddingModelConfig = {
  repoId: string
  modelName: string
  description?: string
  dimensions?: number
  maxTokens?: number
}

export type T_InstalledEmbeddingModel = {
  repoId: string
  modelName: string
  savePath: string
  size: number
}

export type T_InstalledVisionEmbeddingModel = {
  repoId: string
  modelPath: string
  mmprojPath: string
  size: number
}

// ============================================================================
// LLM Configuration Types
// ============================================================================

export interface I_LLM_Init_Options {
  n_gpu_layers?: number
  use_mlock?: boolean
  seed?: number
  n_ctx?: number
  n_batch?: number
  n_threads?: number
  offload_kqv?: boolean
  cache_type_k?: string
  cache_type_v?: string
  verbose?: boolean
}

export interface I_Response_State {
  temperature?: number
  max_tokens?: number
  top_p?: number
  echo?: boolean
  stop?: string
  repeat_penalty?: number
  top_k?: number
  stream?: boolean
  min_p?: number
  presence_penalty?: number // 1.0
  frequency_penalty?: number // 1.0
  tfs_z?: number
  mirostat_tau?: number
  grammar?: string
}

export interface I_LLM_Call_Options extends I_Response_State {
  prompt?: string
  messages?: Message[]
  suffix?: string
  model?: ModelID
  promptTemplate?: string
  systemMessage?: string
  response_mode?: string
}

export interface I_LLM_Options {
  init?: I_LLM_Init_Options
  call?: I_LLM_Call_Options
}

// ============================================================================
// Conversation & Inference Types
// ============================================================================

export const DEFAULT_CONVERSATION_MODE = 'instruct'
export const DEFAULT_TOOL_RESPONSE_MODE = 'answer'
export const TOOL_RESPONSE_MODE_RESULT = 'result'
export const BASE_RETRIEVAL_METHOD = 'base'
export const AUGMENTED_RETRIEVAL_METHOD = 'augmented'
export const AGENT_RETRIEVAL_METHOD = 'agent'
export const DEFAULT_RETRIEVAL_METHOD = BASE_RETRIEVAL_METHOD
export const NATIVE_TOOL_USE = 'native'
export const UNIVERSAL_TOOL_USE = 'universal'
export const DEFAULT_TOOL_USE_MODE = UNIVERSAL_TOOL_USE

// Response synthesizer strategies
export const STRATEGY_REFINE = 'refine'
export const STRATEGY_COMPACT = 'compact'
export const STRATEGY_SIMPLE_SUMMARIZE = 'simple_summarize'
export const STRATEGY_TREE_SUMMARIZE = 'tree_summarize'
export const STRATEGY_NO_TEXT = 'no_text'
export const STRATEGY_CONTEXT_ONLY = 'context_only'
export const STRATEGY_ACCUMULATE = 'accumulate'
export const STRATEGY_COMPACT_ACCUMULATE = 'compact_accumulate'

export type T_ConversationMode = 'instruct' | 'chat' | 'collab'
export type T_ToolResponseMode = 'answer' | 'result'
export type T_ToolUseMode = typeof UNIVERSAL_TOOL_USE | typeof NATIVE_TOOL_USE
export type T_ToolSchemaType = 'json' | 'typescript'
export type T_ResponseStrategy =
  | typeof STRATEGY_REFINE
  | typeof STRATEGY_COMPACT
  | typeof STRATEGY_SIMPLE_SUMMARIZE
  | typeof STRATEGY_TREE_SUMMARIZE
  | typeof STRATEGY_NO_TEXT
  | typeof STRATEGY_CONTEXT_ONLY
  | typeof STRATEGY_ACCUMULATE
  | typeof STRATEGY_COMPACT_ACCUMULATE

export interface I_InferenceGenerateOptions extends T_LLM_InferenceOptions {
  responseMode?: T_ConversationMode
  toolResponseMode?: T_ToolResponseMode
  toolUseMode?: T_ToolUseMode
  messageFormatOverride?: string // Optional, override the backend config
  memory?: I_Knowledge_State
  tools?: string[]
  similarity_top_k?: number
  strategy?: T_ResponseStrategy
}
export type T_LLM_InferenceOptions = I_LLM_Call_Options & I_LLM_Init_Options

export interface I_LoadTextModelRequestPayload {
  responseMode?: T_ConversationMode
  toolUseMode?: T_ToolUseMode
  toolSchemaType?: T_ToolSchemaType
  messages?: Message[]
  raw_input?: boolean
  modelPath: string
  modelId: string
  init: I_LLM_Init_Options
  call: I_LLM_Call_Options
}

export interface I_LoadedModelRes {
  modelId: string
  modelName: string
  responseMode: T_ConversationMode
  modelSettings: I_LLM_Init_Options
  generateSettings: I_LLM_Call_Options
}

// ============================================================================
// Response Types
// ============================================================================

export interface I_NonStreamChatbotResponse {
  metadata: { [key: string]: { order: number; sourceId: string } }
  response: string
  source_nodes: Array<any>
}

export interface I_NonStreamPlayground {
  additional_kwargs: any
  raw: {
    choices: Array<any>
    created: number
    id: string
    model: string
    object: string
    usage: {
      completion_tokens: number
      prompt_tokens: number
      total_tokens: number
    }
  }
  delta: number | null
  logprobs: any
  text: string
}

export interface I_GenericAPIResponse<DataResType> {
  success: boolean
  message: string
  data: DataResType
}

// ============================================================================
// Request Types
// ============================================================================

export type T_GenericDataRes = any
export type T_GenericReqPayload = { [key: string]: any }

export interface I_GenericAPIRequestParams<Payload> {
  queryParams?: Payload
  formData?: FormData
  body?: Payload
  signal?: AbortSignal
}

export type T_GenericAPIRequest<ReqPayload, DataResType> = (
  props?: I_GenericAPIRequestParams<ReqPayload>
) => Promise<I_GenericAPIResponse<DataResType> | null>

export type T_SaveChatThreadAPIRequest = (props: {
  body: {
    threadId: string
    thread: I_Thread
  }
}) => Promise<I_GenericAPIResponse<T_GenericDataRes>>

export type T_GetChatThreadAPIRequest = (props: {
  queryParams: {
    threadId?: string | null
  }
}) => Promise<I_GenericAPIResponse<I_Thread[]>>

export type T_DeleteChatThreadAPIRequest = (props: {
  queryParams: {
    threadId?: string | null
  }
}) => Promise<I_GenericAPIResponse<I_Thread[]>>

// ============================================================================
// Knowledge & Memory Types
// ============================================================================

export interface I_Knowledge_State {
  ids: string[] // collection names
}

export interface I_RAG_Strat_State {
  similarity_top_k: number
  response_mode: string | undefined
}

export interface I_ChunkMetadata {
  _node_type: string
  _node_content: any
  sourceId: string
  ref_doc_id: string
  order: number
}

export interface I_Source {
  id: string
  document_name: string
  embedding_model: string
  checksum: string
  urlPath: string
  source_file_name: string
  source_file_path: string
  file_path: string
  file_type: string
  file_name: string
  file_size: number
  modified_last: string
  created_at: string
  description: string
  tags: string
  chunkIds: Array<string>
}

export interface I_DocumentChunk {
  text: string
  id: string
  metadata: I_ChunkMetadata
}

export interface I_Collection {
  id: string
  name: string
  metadata: {
    description: string
    embedding_model: string
    tags: string
    icon: string
    sources: Array<I_Source>
    created_at?: string // @TODO dupe
    sharePath?: string
    favorites?: number
    createdAt?: string // @TODO dupe
  }
}

// ============================================================================
// Tool Types
// ============================================================================

export type T_InputOptionTypes =
  | 'options-sel'
  | 'options-multi'
  | 'options-button'
  | 'text'
  | 'text-multi'

export type T_Tool_Param_Option = string[] | number[]

export interface I_Tool_Parameter {
  name: string
  title: string
  description: string
  type: string
  placeholder?: string
  input_type?: T_InputOptionTypes
  default_value?: any
  value?: any
  min_value?: string | number
  max_value?: string | number
  options_source?: string
  options_description?: string[]
  options?: string[]
  items?: any[]
}

export interface I_Tool_Def_Parameter extends I_Tool_Parameter {
  value?: any
}

export interface I_ToolFunctionSchemaRes {
  params: I_Tool_Parameter[]
  description?: string | undefined
  params_schema?: any | undefined
  params_example?: any | undefined
  output_type?: string[]
  json_schema?: string | undefined
  typescript_schema?: string | undefined
}

export interface I_Tool_Definition extends I_ToolFunctionSchemaRes {
  name: string
  path: string
  id?: string | undefined // assigned on tool save
}

// ============================================================================
// Settings Types
// ============================================================================

export type T_PromptTemplate = {
  id: string
  name: string
  text: string
}

export type T_SystemPrompt = {
  id: string
  name: string
  text: string
}

export interface I_PromptTemplates {
  [key: string]: T_PromptTemplate[]
}

export type T_SystemPrompts = {
  presets: { [key: string]: T_SystemPrompt[] }
}

export type I_Prompt_State = {
  promptTemplate: T_PromptTemplate
}

export interface I_Model_State {
  id: string | undefined
  botName?: string
  filename: string | undefined
}

export interface I_System_State {
  systemMessage: string | undefined
  systemMessageName: string | undefined
}

export interface I_Attention_State {
  tool_use_mode: T_ToolUseMode
  tool_response_mode: T_ToolResponseMode
  response_mode: T_ConversationMode
}

export interface I_Tools_Inference_State {
  assigned: string[]
}

export interface I_Text_Settings {
  tools: I_Tools_Inference_State
  attention: I_Attention_State
  performance: I_LLM_Init_Options
  system: I_System_State
  model: I_Model_State
  prompt: I_Prompt_State
  response: I_Response_State
  memory: I_Knowledge_State
}

// ============================================================================
// API Configuration Types
// ============================================================================

export interface I_ConnectionConfig {
  protocol: string
  domain: string
  port: string
  version: string
  enabled: boolean
}

export interface I_Connection {
  config: I_ConnectionConfig
  api: I_ServiceApis | null
}

export type T_APIConfigOptions = {
  chunkingStrategies?: Array<string>
  domain?: string
  port?: string
}

export interface I_Endpoint {
  name: string
  urlPath: string
  method: string
}

export interface I_API {
  name: string
  port: number
  endpoints: Array<I_Endpoint>
  configs?: T_APIConfigOptions
}

export interface I_ServicesResponse {
  success: boolean
  message: string
  data: Array<I_API>
}

export interface I_ConnectResponse {
  success: boolean
  message: string
  data: { docs: string }
}

// ============================================================================
// Hardware Types
// ============================================================================

export interface I_HardwareInfo {
  gpu_type: string
  gpu_name: string
  driver_ver: string
  manufacturer: string
  dac_type: string
  pnp_device_id: string
  id?: number
  vram_total?: number
  vram_used?: number
  vram_free?: number
}

export interface I_HardwareAuditResponse {
  success: boolean
  message: string
  data: I_HardwareInfo[]
}

// ============================================================================
// Service API Types
// ============================================================================

export type T_Endpoint = { [key: string]: any }

export interface I_BaseServiceApis {
  [key: string]: T_Endpoint
}

export type T_TextInferenceAPIRequest = (props: {
  body: I_InferenceGenerateOptions
  signal: AbortSignal
}) => Promise<
  | Response
  | I_NonStreamPlayground
  | I_NonStreamChatbotResponse
  | string // a JSON string
  | I_GenericAPIResponse<any>
  | null
>

export interface I_DeleteTextModelReqPayload {
  repoId: string
  filename: string
}

export interface I_ToolSchemaReqPayload {
  filename: string
  tool_name: string
}

export interface I_DownloadEmbeddingModelPayload {
  repo_id: string
  filename: string
}

export interface I_DeleteEmbeddingModelPayload {
  repoId: string
}

export interface I_GetEmbedModelInfoPayload {
  repoId: string
}

// ============================================================================
// Vision Types
// ============================================================================

export interface I_VisionGenerateRequest {
  prompt: string
  images: string[] // Base64 encoded images
  image_type?: 'base64' | 'path'
  stream?: boolean
  max_tokens?: number
  temperature?: number
}

export interface I_VisionGenerateResponse {
  text: string
  finish_reason?: string
}

export interface I_LoadVisionModelRequest {
  modelPath: string
  mmprojPath: string
  modelId: string
  init: I_LLM_Init_Options
  call: I_LLM_Call_Options
}

export interface I_DownloadMmprojPayload {
  repo_id: string
  filename: string
  model_repo_id: string
}

// ============================================================================
// Vision Embedding Types
// ============================================================================

export interface I_VisionEmbedLoadRequest {
  model_path: string
  mmproj_path: string
  model_name?: string
  model_id?: string
  port?: number
  n_gpu_layers?: number
  n_threads?: number
  n_ctx?: number
}

export interface I_VisionEmbedLoadResponse {
  model_name: string
  model_id: string
  port: number
}

export interface I_VisionEmbedRequest {
  image_path?: string
  image_base64?: string
  image_type?: 'path' | 'base64'
  collection_name?: string
  transcription_text?: string
}

export interface I_VisionEmbedResponse {
  id: string
  collection_name: string
  embedding_dim: number
  transcription?: string
  metadata?: Record<string, any>
}

export interface I_VisionEmbedModelInfo {
  model_name: string
  model_id: string
  port: number
  is_running: boolean
}

export interface I_VisionEmbedDownloadRequest {
  repo_id: string
  filename: string
  mmproj_filename: string
}

export interface I_VisionEmbedDownloadResponse {
  repoId: string
  modelPath: string
  mmprojPath: string
  size: number
}

export interface I_ServiceApis extends I_BaseServiceApis {
  /**
   * Use to query the text inference engine
   */
  textInference: {
    generate: T_TextInferenceAPIRequest
    stop: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    load: T_GenericAPIRequest<
      I_LoadTextModelRequestPayload,
      I_GenericAPIResponse<undefined>
    >
    unload: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    model: T_GenericAPIRequest<T_GenericReqPayload, I_LoadedModelRes> // Currently loaded text model
    modelExplore: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    installed: T_GenericAPIRequest<T_GenericReqPayload, T_InstalledTextModel[]> // List of currently installed text models
    getModelMetadata: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    getModelInfo: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    download: T_GenericAPIRequest<T_GenericReqPayload, string>
    delete: T_GenericAPIRequest<I_DeleteTextModelReqPayload, T_GenericDataRes>
    getModelConfigs: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    auditHardware: T_GenericAPIRequest<T_GenericReqPayload, I_HardwareInfo[]>
    // getPromptTemplates: T_GenericAPIRequest<
    //   T_GenericReqPayload,
    //   T_GenericDataRes
    // >;
    // getSystemPrompts: T_GenericAPIRequest<
    //   T_GenericReqPayload,
    //   T_GenericDataRes
    // >;
  }
  /**
   * Use to add/create/update/delete embeddings from database
   */
  memory: {
    addDocument: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    getChunks: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    updateDocument: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    deleteDocuments: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    getAllCollections: T_GenericAPIRequest<
      T_GenericReqPayload,
      T_GenericDataRes
    >
    addCollection: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    getCollection: T_GenericAPIRequest<T_GenericReqPayload, I_Collection>
    deleteCollection: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    fileExplore: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    wipe: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    // @TODO These embedModel should be in its' own "textEmbed" object
    downloadEmbedModel: T_GenericAPIRequest<
      I_DownloadEmbeddingModelPayload,
      T_GenericDataRes
    >
    installedEmbedModels: T_GenericAPIRequest<
      T_GenericReqPayload,
      T_InstalledEmbeddingModel[]
    >
    availableEmbedModels: T_GenericAPIRequest<
      T_GenericReqPayload,
      T_EmbeddingModelConfig[]
    >
    deleteEmbedModel: T_GenericAPIRequest<
      I_DeleteEmbeddingModelPayload,
      T_GenericDataRes
    >
    getEmbedModelInfo: T_GenericAPIRequest<
      I_GetEmbedModelInfoPayload,
      T_GenericDataRes
    >
    configs: {
      chunkingStrategies: Array<string>
    }
  }
  /**
   * Use to persist data specific to the app itself
   */
  storage: {
    getToolSchema: T_GenericAPIRequest<
      I_ToolSchemaReqPayload,
      I_ToolFunctionSchemaRes
    >
    getToolFunctions: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    saveToolSettings?: T_GenericAPIRequest<T_GenericReqPayload, null>
    getToolSettings?: T_GenericAPIRequest<
      T_GenericReqPayload,
      I_Tool_Definition[]
    >
    deleteToolSettings?: T_GenericAPIRequest<T_GenericReqPayload, null>
    getBotSettings: T_GenericAPIRequest<T_GenericReqPayload, I_Text_Settings[]>
    deleteBotSettings: T_GenericAPIRequest<
      T_GenericReqPayload,
      I_Text_Settings[]
    >
    saveBotSettings: T_GenericAPIRequest<T_GenericReqPayload, I_Text_Settings[]>
    saveChatThread: T_SaveChatThreadAPIRequest
    getChatThread: T_GetChatThreadAPIRequest
    deleteChatThread: T_DeleteChatThreadAPIRequest
  }
  /**
   * Use to query the vision inference engine for image transcription
   */
  // @TODO Do we need sep visionInference or can textInference detect if model is multimodal? Cuz we use that to download/delete...
  visionInference: {
    load: T_GenericAPIRequest<I_LoadVisionModelRequest, T_GenericDataRes>
    unload: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    generate: T_GenericAPIRequest<
      I_VisionGenerateRequest,
      I_VisionGenerateResponse
    >
  }
  /**
   * Use for image embedding operations
   */
  visionEmbed: {
    // @TODO rly need this? We auto load when calling /generate
    load: T_GenericAPIRequest<
      I_VisionEmbedLoadRequest,
      I_VisionEmbedLoadResponse
    >
    // @TODO rly need this? We always unload after exec
    unload: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    embed: T_GenericAPIRequest<I_VisionEmbedRequest, I_VisionEmbedResponse>
    // @TODO rly need this?
    model: T_GenericAPIRequest<T_GenericReqPayload, I_VisionEmbedModelInfo>
    download: T_GenericAPIRequest<
      I_VisionEmbedDownloadRequest,
      I_VisionEmbedDownloadResponse
    >
    delete: T_GenericAPIRequest<{ repoId: string }, T_GenericDataRes>
    installedModels: T_GenericAPIRequest<
      T_GenericReqPayload,
      T_InstalledVisionEmbeddingModel[]
    >
  }
}
