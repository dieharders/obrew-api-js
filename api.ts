import { useCallback } from 'react'
import { type Message } from 'ai/react'
import appSettings from '@/lib/localStorage'

export enum ModelID {
  GPT3 = 'gpt3.5',
  GPT4 = 'gpt4',
  GPTNeo = 'gpt-neoxt-20B', // together/
  Cohere = 'xlarge', // cohere/
  Local = 'local', // 3rd party, local server
}

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

export type T_APIConfigOptions = {
  chunkingStrategies?: Array<string>
  domain?: string
  port?: string
}

export interface I_InferenceGenerateOptions extends T_LLM_InferenceOptions {
  responseMode?: T_ConversationMode
  toolResponseMode?: T_ToolResponseMode
  toolUseMode?: T_ToolUseMode
  messageFormat?: string
  memory?: I_Knowledge_State
  tools?: string[]
}

type T_LLM_InferenceOptions = I_LLM_Call_Options & I_LLM_Init_Options

interface I_Endpoint {
  name: string
  urlPath: string
  method: string
}

interface I_API {
  name: string
  port: number
  endpoints: Array<I_Endpoint>
  configs?: T_APIConfigOptions
}

interface I_ServicesResponse {
  success: boolean
  message: string
  data: Array<I_API>
}

interface I_ConnectResponse {
  success: boolean
  message: string
  data: { docs: string }
}

export const DEFAULT_CONVERSATION_MODE = 'instruct'
export const DEFAULT_TOOL_RESPONSE_MODE = 'answer'
export const BASE_RETRIEVAL_METHOD = 'base'
export const AUGMENTED_RETRIEVAL_METHOD = 'augmented'
export const AGENT_RETRIEVAL_METHOD = 'agent'
export const DEFAULT_RETRIEVAL_METHOD = BASE_RETRIEVAL_METHOD
// export const DEFAULT_ACTIVE_ROLE = 'agent'
export const NATIVE_TOOL_USE = 'native'
export const UNIVERSAL_TOOL_USE = 'universal'
export const DEFAULT_TOOL_USE_MODE = UNIVERSAL_TOOL_USE
export type T_ConversationMode = 'instruct' | 'chat' | 'collab'
export type T_ToolResponseMode = 'answer' | 'result'
// export type T_ActiveRoles = 'agent' | 'worker'
export type T_ToolUseMode = typeof UNIVERSAL_TOOL_USE | typeof NATIVE_TOOL_USE
export type T_ToolSchemaType = 'json' | 'typescript'

export type T_GenericDataRes = any
export type T_GenericReqPayload = { [key: string]: any }

type T_SaveChatThreadAPIRequest = (props: {
  body: {
    threadId: string
    thread: I_Thread
  }
}) => Promise<I_GenericAPIResponse<T_GenericDataRes>>

type T_GetChatThreadAPIRequest = (props: {
  queryParams: {
    threadId?: string | null
  }
}) => Promise<I_GenericAPIResponse<I_Thread[]>>

type T_DeleteChatThreadAPIRequest = (props: {
  queryParams: {
    threadId?: string | null
  }
}) => Promise<I_GenericAPIResponse<I_Thread[]>>

// A non-streaming response
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

// Use 'body' for POST requests with complex (arrays) data types
// Use 'queryParams' for POST requests with simple data structs and forms
// Use 'formData' for POST requests with complex forms (binary uploads)
export interface I_GenericAPIRequestParams<Payload> {
  queryParams?: Payload
  formData?: FormData
  body?: Payload
  signal?: AbortSignal
}

// Pass in the type of response.data we expect
export type T_GenericAPIRequest<ReqPayload, DataResType> = (
  props?: I_GenericAPIRequestParams<ReqPayload>,
) => Promise<I_GenericAPIResponse<DataResType> | null>

export interface I_ChunkMetadata {
  _node_type: string
  _node_content: any
  sourceId: string
  ref_doc_id: string
  order: number
}

// These are the sources (documents) kept track by a collection
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
    created_at?: string
    sharePath?: string
    favorites?: number
    createdAt?: string
  }
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

export interface I_Knowledge_State {
  ids: string[] // collection names
}

// @TODO Can maybe remove after retrieval is re-implemented
export interface I_RAG_Strat_State {
  similarity_top_k: number
  response_mode: string | undefined
}

export type I_Prompt_State = {
  promptTemplate: T_PromptTemplate
}

export interface I_Model_State {
  id: string | undefined // @TODO change to modelId
  botName?: string
  filename: string | undefined // @TODO change to modelFileName
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

// The types of UI input that can be used for displaying a tool's params
export type T_InputOptionTypes =
  | 'options-sel'
  | 'options-multi'
  | 'options-button'
  | 'text'
  | 'text-multi'

export interface I_Tool_Def_Parameter extends I_Tool_Parameter {
  value?: any
}

export type T_Tool_Param_Option = string[] | number[]

// Tool function's field data returned from server
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

// Tool function's struct from server
export interface I_ToolFunctionSchemaRes {
  params: I_Tool_Parameter[]
  description?: string | undefined
  params_schema?: any | undefined
  params_example?: any | undefined
  output_type?: string[]
}

// Tool struct that is persisted to disk
export interface I_Tool_Definition extends I_ToolFunctionSchemaRes {
  name: string
  path: string
  id?: string | undefined // assigned on tool save
}

type T_Endpoint = { [key: string]: any }

interface I_BaseServiceApis {
  [key: string]: T_Endpoint
}

type T_TextInferenceAPIRequest = (props: {
  body: I_InferenceGenerateOptions
  signal: AbortSignal
}) =>
  | (Response &
      I_NonStreamPlayground &
      I_NonStreamChatbotResponse &
      string & // a JSON string
      I_GenericAPIResponse<any>)
  | null

interface I_DeleteTextModelReqPayload {
  repoId: string
  filename: string
}

interface I_ToolSchemaReqPayload {
  filename: string
}

export interface I_LoadedModelRes {
  modelId: string
  modelName: string
  responseMode: T_ConversationMode
  modelSettings: I_LLM_Init_Options
  generateSettings: I_LLM_Call_Options
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
    getPromptTemplates: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    getSystemPrompts: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
  }
  /**
   * Use to add/create/update/delete embeddings from database
   */
  memory: {
    addDocument: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    getChunks: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    updateDocument: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    deleteDocuments: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    getAllCollections: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    addCollection: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    getCollection: T_GenericAPIRequest<T_GenericReqPayload, I_Collection>
    deleteCollection: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    fileExplore: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    wipe: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    configs: {
      chunkingStrategies: Array<string>
    }
  }
  /**
   * Use to persist data specific to the app itself
   */
  storage: {
    getToolSchema: T_GenericAPIRequest<I_ToolSchemaReqPayload, I_ToolFunctionSchemaRes>
    getToolFunctions: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>
    saveToolSettings?: T_GenericAPIRequest<T_GenericReqPayload, null>
    getToolSettings?: T_GenericAPIRequest<T_GenericReqPayload, I_Tool_Definition[]>
    deleteToolSettings?: T_GenericAPIRequest<T_GenericReqPayload, null>
    getBotSettings: T_GenericAPIRequest<T_GenericReqPayload, I_Text_Settings[]>
    deleteBotSettings: T_GenericAPIRequest<T_GenericReqPayload, I_Text_Settings[]>
    saveBotSettings: T_GenericAPIRequest<T_GenericReqPayload, I_Text_Settings[]>
    saveChatThread: T_SaveChatThreadAPIRequest
    getChatThread: T_GetChatThreadAPIRequest
    deleteChatThread: T_DeleteChatThreadAPIRequest
  }
}

export const defaultPort = '8008'
export const defaultDomain = 'http://localhost'
const createDomainName = () => {
  const { port, domain } = appSettings.getHostConnection()
  const PORT = port || defaultPort
  const DOMAIN = domain === '0.0.0.0' ? defaultDomain : domain
  const origin = `${DOMAIN}:${PORT}`
  return origin
}

const fetchConnect = async (): Promise<I_ConnectResponse | null> => {
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }

  try {
    const domain = createDomainName()
    const res = await fetch(`${domain}/v1/connect`, options)
    if (!res.ok) throw new Error(`[homebrew] HTTP error! Status: ${res.status}`)
    if (!res) throw new Error('[homebrew] No response received.')
    return res.json()
  } catch (err) {
    console.log('[homebrew] connectToServer error:', err)
    return null
  }
}

const fetchAPIConfig = async (): Promise<I_ServicesResponse | null> => {
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }

  try {
    const endpoint = '/v1/services/api'
    const domain = createDomainName()
    const res = await fetch(`${domain}${endpoint}`, options)
    if (!res.ok) throw new Error(`[homebrew] HTTP error! Status: ${res.status}`)
    if (!res) throw new Error(`[homebrew] No response from ${endpoint}`)
    return res.json()
  } catch (err) {
    console.log('[homebrew] fetchAPIConfig error:', err)
    return null
  }
}

const getPromptTemplates = async () => {
  // Read in json file
  const file = await import('../data/prompt-templates.json')

  return {
    success: true,
    message: 'Returned all prompt templates for text inference.',
    data: file.default,
  }
}

const getSystemPrompts = async () => {
  // Read in json file
  const file = await import('../data/system-prompts.json')

  return {
    success: true,
    message: 'Returned all system prompts for text inference.',
    data: file?.default,
  }
}

// Builds services and their methods for use by front-end
const createServices = (response: I_API[] | null): I_ServiceApis | null => {
  if (!response || response.length === 0) return null

  const serviceApis = {} as I_ServiceApis

  // Construct api funcs for each service
  response.forEach(api => {
    const origin = `${createDomainName()}`
    const apiName = api.name
    const endpoints: { [key: string]: (args: any) => Promise<Response | null> } & {
      configs?: T_APIConfigOptions
    } = {}
    let res: Response

    // Parse endpoint urls
    api.endpoints.forEach(endpoint => {
      // Create a curried fetch function
      const request = async (args: I_GenericAPIRequestParams<T_GenericReqPayload>) => {
        try {
          const contentType = { 'Content-Type': 'application/json' }
          const method = endpoint.method
          const headers = { ...(method === 'POST' && !args?.formData && contentType) }
          const body = args?.formData ? args.formData : JSON.stringify(args?.body)
          const signal = args?.signal
          const queryParams = args?.queryParams
            ? new URLSearchParams(args?.queryParams).toString()
            : null
          const queryUrl = queryParams ? `?${queryParams}` : ''
          const url = `${origin}${endpoint.urlPath}${queryUrl}`

          res = await fetch(url, {
            method,
            mode: 'cors', // no-cors, *, cors, same-origin
            cache: 'no-cache',
            credentials: 'same-origin',
            headers, // { 'Content-Type': 'multipart/form-data' }, // Browser will set this automatically for us for "formData"
            redirect: 'follow',
            referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            body,
            ...(signal && { signal }),
          })

          // Check no response
          if (!res) throw new Error(`No response for endpoint ${endpoint.name}.`)

          // Check bad request
          if (!res?.ok) throw new Error(`Something went wrong. ${res?.statusText}`)

          // Check json response
          const responseType = res.headers.get('content-type')
          if (res.json && !responseType?.includes('event-stream')) {
            const result = await res.json()

            if (!result) throw new Error('Something went wrong')
            // Check failure from homebrew api
            if (typeof result?.success === 'boolean' && !result?.success)
              throw new Error(
                `An unexpected error occurred for [${endpoint.name}] endpoint: ${
                  result?.message ?? result?.detail
                }`,
              )
            // Success
            return result
          }
          // Return raw response from llama-cpp-python server text inference @TODO Is needed?
          return res
        } catch (err) {
          console.log(`[homebrew] Endpoint "${endpoint.name}":`, err)
          return { success: false, message: err }
        }
      }

      // Add request function for this endpoint
      endpoints[endpoint.name] = request
      // Set api configs
      endpoints.configs = api.configs || {}
    })
    // Set api callbacks
    serviceApis[apiName] = endpoints
  })

  // Inject non-backend related methods
  serviceApis.textInference.getPromptTemplates = getPromptTemplates
  serviceApis.textInference.getSystemPrompts = getSystemPrompts

  return serviceApis
}

const connectToLocalProvider = async (): Promise<I_ConnectResponse | null> => {
  const conn = await fetchConnect()
  console.log('[homebrew] Connecting:', conn)

  const connected = conn?.success
  if (!connected) return null

  console.log(`[homebrew] Connected to local ai engine: ${conn.message}`)
  return conn
}

export const getAPIConfig = async () => {
  const config = await fetchAPIConfig()
  console.log('[homebrew] getAPIConfig:', config)

  const success = config?.success
  if (!success) return null

  const apis = config.data
  return apis
}

/**
 * Hook for Homebrew api that handles state and connections.
 */
export const useHomebrew = () => {
  /**
   * Get all api configs for services.
   */
  const getServices = useCallback(async () => {
    const res = await getAPIConfig()
    // Store all config options for endpoints
    let configOptions: T_APIConfigOptions = {}
    res?.forEach(i => {
      if (i.configs) configOptions = { ...configOptions, ...i.configs }
    })
    // Return readily usable request funcs
    const serviceApis = createServices(res)
    return serviceApis
  }, [])

  /**
   * Attempt to connect to homebrew api.
   */
  const connect = useCallback(async () => {
    const result = await connectToLocalProvider()
    if (!result?.success) return null

    // Attempt to return api services
    await getServices()

    return result
  }, [getServices])

  return {
    connect,
    getServices,
  }
}
