type Message = {
    id: string;
    createdAt?: Date | undefined;
    content: string;
    role: "system" | "user" | "assistant";
};
interface I_Message {
    id: string;
    content: string;
    role: "system" | "user" | "assistant";
    createdAt?: string;
    modelId?: string;
    username?: string;
}
interface I_Thread {
    id: string;
    userId: string;
    createdAt: string;
    title: string;
    summary: string;
    numMessages: number;
    messages: Array<I_Message>;
    sharePath?: string;
}
declare enum ModelID {
    GPT3 = "gpt3.5",
    GPT4 = "gpt4",
    GPTNeo = "gpt-neoxt-20B",
    Cohere = "xlarge",
    Local = "local"
}
type T_ModelConfig = {
    repoId: string;
    name: string;
    description?: string;
    messageFormat?: string;
};
interface I_ModelConfigs {
    [key: string]: T_ModelConfig;
}
type T_InstalledTextModel = {
    repoId: string;
    savePath: {
        [key: string]: string;
    };
    numTimesRun: number;
    isFavorited: boolean;
    validation: string;
    modified: string;
    size: number;
    endChunk: number;
    progress: number;
    tokenizerPath: string;
    checksum: string;
};
interface I_LLM_Init_Options {
    n_gpu_layers?: number;
    use_mlock?: boolean;
    seed?: number;
    n_ctx?: number;
    n_batch?: number;
    n_threads?: number;
    offload_kqv?: boolean;
    cache_type_k?: string;
    cache_type_v?: string;
    verbose?: boolean;
}
interface I_Response_State {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    echo?: boolean;
    stop?: string;
    repeat_penalty?: number;
    top_k?: number;
    stream?: boolean;
    min_p?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    tfs_z?: number;
    mirostat_tau?: number;
    grammar?: string;
}
interface I_LLM_Call_Options extends I_Response_State {
    prompt?: string;
    messages?: Message[];
    suffix?: string;
    model?: ModelID;
    promptTemplate?: string;
    systemMessage?: string;
    response_mode?: string;
}
interface I_LLM_Options {
    init?: I_LLM_Init_Options;
    call?: I_LLM_Call_Options;
}
declare const DEFAULT_CONVERSATION_MODE = "instruct";
declare const DEFAULT_TOOL_RESPONSE_MODE = "answer";
declare const BASE_RETRIEVAL_METHOD = "base";
declare const AUGMENTED_RETRIEVAL_METHOD = "augmented";
declare const AGENT_RETRIEVAL_METHOD = "agent";
declare const DEFAULT_RETRIEVAL_METHOD = "base";
declare const NATIVE_TOOL_USE = "native";
declare const UNIVERSAL_TOOL_USE = "universal";
declare const DEFAULT_TOOL_USE_MODE = "universal";
type T_ConversationMode = "instruct" | "chat" | "collab";
type T_ToolResponseMode = "answer" | "result";
type T_ToolUseMode = typeof UNIVERSAL_TOOL_USE | typeof NATIVE_TOOL_USE;
type T_ToolSchemaType = "json" | "typescript";
interface I_InferenceGenerateOptions extends T_LLM_InferenceOptions {
    responseMode?: T_ConversationMode;
    toolResponseMode?: T_ToolResponseMode;
    toolUseMode?: T_ToolUseMode;
    messageFormat?: string;
    memory?: I_Knowledge_State;
    tools?: string[];
}
type T_LLM_InferenceOptions = I_LLM_Call_Options & I_LLM_Init_Options;
interface I_LoadTextModelRequestPayload {
    responseMode?: T_ConversationMode;
    toolUseMode?: T_ToolUseMode;
    toolSchemaType?: T_ToolSchemaType;
    messages?: Message[];
    raw_input?: boolean;
    modelPath: string;
    modelId: string;
    init: I_LLM_Init_Options;
    call: I_LLM_Call_Options;
}
interface I_LoadedModelRes {
    modelId: string;
    modelName: string;
    responseMode: T_ConversationMode;
    modelSettings: I_LLM_Init_Options;
    generateSettings: I_LLM_Call_Options;
}
interface I_NonStreamChatbotResponse {
    metadata: {
        [key: string]: {
            order: number;
            sourceId: string;
        };
    };
    response: string;
    source_nodes: Array<any>;
}
interface I_NonStreamPlayground {
    additional_kwargs: any;
    raw: {
        choices: Array<any>;
        created: number;
        id: string;
        model: string;
        object: string;
        usage: {
            completion_tokens: number;
            prompt_tokens: number;
            total_tokens: number;
        };
    };
    delta: number | null;
    logprobs: any;
    text: string;
}
interface I_GenericAPIResponse<DataResType> {
    success: boolean;
    message: string;
    data: DataResType;
}
type T_GenericDataRes = any;
type T_GenericReqPayload = {
    [key: string]: any;
};
interface I_GenericAPIRequestParams<Payload> {
    queryParams?: Payload;
    formData?: FormData;
    body?: Payload;
    signal?: AbortSignal;
}
type T_GenericAPIRequest<ReqPayload, DataResType> = (props?: I_GenericAPIRequestParams<ReqPayload>) => Promise<I_GenericAPIResponse<DataResType> | null>;
type T_SaveChatThreadAPIRequest = (props: {
    body: {
        threadId: string;
        thread: I_Thread;
    };
}) => Promise<I_GenericAPIResponse<T_GenericDataRes>>;
type T_GetChatThreadAPIRequest = (props: {
    queryParams: {
        threadId?: string | null;
    };
}) => Promise<I_GenericAPIResponse<I_Thread[]>>;
type T_DeleteChatThreadAPIRequest = (props: {
    queryParams: {
        threadId?: string | null;
    };
}) => Promise<I_GenericAPIResponse<I_Thread[]>>;
interface I_Knowledge_State {
    ids: string[];
}
interface I_RAG_Strat_State {
    similarity_top_k: number;
    response_mode: string | undefined;
}
interface I_ChunkMetadata {
    _node_type: string;
    _node_content: any;
    sourceId: string;
    ref_doc_id: string;
    order: number;
}
interface I_Source {
    id: string;
    document_name: string;
    embedding_model: string;
    checksum: string;
    urlPath: string;
    source_file_name: string;
    source_file_path: string;
    file_path: string;
    file_type: string;
    file_name: string;
    file_size: number;
    modified_last: string;
    created_at: string;
    description: string;
    tags: string;
    chunkIds: Array<string>;
}
interface I_DocumentChunk {
    text: string;
    id: string;
    metadata: I_ChunkMetadata;
}
interface I_Collection {
    id: string;
    name: string;
    metadata: {
        description: string;
        embedding_model: string;
        tags: string;
        icon: string;
        sources: Array<I_Source>;
        created_at?: string;
        sharePath?: string;
        favorites?: number;
        createdAt?: string;
    };
}
type T_InputOptionTypes = "options-sel" | "options-multi" | "options-button" | "text" | "text-multi";
type T_Tool_Param_Option = string[] | number[];
interface I_Tool_Parameter {
    name: string;
    title: string;
    description: string;
    type: string;
    placeholder?: string;
    input_type?: T_InputOptionTypes;
    default_value?: any;
    value?: any;
    min_value?: string | number;
    max_value?: string | number;
    options_source?: string;
    options_description?: string[];
    options?: string[];
    items?: any[];
}
interface I_Tool_Def_Parameter extends I_Tool_Parameter {
    value?: any;
}
interface I_ToolFunctionSchemaRes {
    params: I_Tool_Parameter[];
    description?: string | undefined;
    params_schema?: any | undefined;
    params_example?: any | undefined;
    output_type?: string[];
}
interface I_Tool_Definition extends I_ToolFunctionSchemaRes {
    name: string;
    path: string;
    id?: string | undefined;
}
type T_PromptTemplate = {
    id: string;
    name: string;
    text: string;
};
type T_SystemPrompt = {
    id: string;
    name: string;
    text: string;
};
interface I_PromptTemplates {
    [key: string]: T_PromptTemplate[];
}
type T_SystemPrompts = {
    presets: {
        [key: string]: T_SystemPrompt[];
    };
};
type I_Prompt_State = {
    promptTemplate: T_PromptTemplate;
};
interface I_Model_State {
    id: string | undefined;
    botName?: string;
    filename: string | undefined;
}
interface I_System_State {
    systemMessage: string | undefined;
    systemMessageName: string | undefined;
}
interface I_Attention_State {
    tool_use_mode: T_ToolUseMode;
    tool_response_mode: T_ToolResponseMode;
    response_mode: T_ConversationMode;
}
interface I_Tools_Inference_State {
    assigned: string[];
}
interface I_Text_Settings {
    tools: I_Tools_Inference_State;
    attention: I_Attention_State;
    performance: I_LLM_Init_Options;
    system: I_System_State;
    model: I_Model_State;
    prompt: I_Prompt_State;
    response: I_Response_State;
    memory: I_Knowledge_State;
}
interface I_ObrewConfig {
    domain: string;
    port: string;
    version: string;
    enabled: boolean;
}
interface I_ObrewConnection {
    config: I_ObrewConfig;
    api: I_ServiceApis | null;
}
type T_APIConfigOptions = {
    chunkingStrategies?: Array<string>;
    domain?: string;
    port?: string;
};
interface I_Endpoint {
    name: string;
    urlPath: string;
    method: string;
}
interface I_API {
    name: string;
    port: number;
    endpoints: Array<I_Endpoint>;
    configs?: T_APIConfigOptions;
}
interface I_ServicesResponse {
    success: boolean;
    message: string;
    data: Array<I_API>;
}
interface I_ConnectResponse {
    success: boolean;
    message: string;
    data: {
        docs: string;
    };
}
type T_Endpoint = {
    [key: string]: any;
};
interface I_BaseServiceApis {
    [key: string]: T_Endpoint;
}
type T_TextInferenceAPIRequest = (props: {
    body: I_InferenceGenerateOptions;
    signal: AbortSignal;
}) => Promise<Response | I_NonStreamPlayground | I_NonStreamChatbotResponse | string | I_GenericAPIResponse<any> | null>;
interface I_DeleteTextModelReqPayload {
    repoId: string;
    filename: string;
}
interface I_ToolSchemaReqPayload {
    filename: string;
}
interface I_ServiceApis extends I_BaseServiceApis {
    textInference: {
        generate: T_TextInferenceAPIRequest;
        stop: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        load: T_GenericAPIRequest<I_LoadTextModelRequestPayload, I_GenericAPIResponse<undefined>>;
        unload: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        model: T_GenericAPIRequest<T_GenericReqPayload, I_LoadedModelRes>;
        modelExplore: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        installed: T_GenericAPIRequest<T_GenericReqPayload, T_InstalledTextModel[]>;
        getModelMetadata: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        getModelInfo: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        download: T_GenericAPIRequest<T_GenericReqPayload, string>;
        delete: T_GenericAPIRequest<I_DeleteTextModelReqPayload, T_GenericDataRes>;
        getModelConfigs: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
    };
    memory: {
        addDocument: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        getChunks: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        updateDocument: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        deleteDocuments: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        getAllCollections: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        addCollection: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        getCollection: T_GenericAPIRequest<T_GenericReqPayload, I_Collection>;
        deleteCollection: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        fileExplore: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        wipe: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        configs: {
            chunkingStrategies: Array<string>;
        };
    };
    storage: {
        getToolSchema: T_GenericAPIRequest<I_ToolSchemaReqPayload, I_ToolFunctionSchemaRes>;
        getToolFunctions: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        saveToolSettings?: T_GenericAPIRequest<T_GenericReqPayload, null>;
        getToolSettings?: T_GenericAPIRequest<T_GenericReqPayload, I_Tool_Definition[]>;
        deleteToolSettings?: T_GenericAPIRequest<T_GenericReqPayload, null>;
        getBotSettings: T_GenericAPIRequest<T_GenericReqPayload, I_Text_Settings[]>;
        deleteBotSettings: T_GenericAPIRequest<T_GenericReqPayload, I_Text_Settings[]>;
        saveBotSettings: T_GenericAPIRequest<T_GenericReqPayload, I_Text_Settings[]>;
        saveChatThread: T_SaveChatThreadAPIRequest;
        getChatThread: T_GetChatThreadAPIRequest;
        deleteChatThread: T_DeleteChatThreadAPIRequest;
    };
}

declare class ObrewClient {
    private isConnected;
    private abortController;
    private connection;
    isServiceConnected(): boolean;
    getConnection(): I_ObrewConnection;
    connect(config: I_ObrewConfig): Promise<boolean>;
    ping(timeout?: number): Promise<{
        success: boolean;
        responseTime?: number;
        error?: string;
    }>;
    cancelRequest(): void;
    disconnect(): void;
    private handleStreamingResponse;
    private extractTextFromResponse;
    sendMessage(messages: Message[], options?: Partial<I_InferenceGenerateOptions>): Promise<string>;
    loadModel(modelPath: string, modelId: string): Promise<boolean>;
    getLoadedModel(): Promise<I_LoadedModelRes | null>;
    getInstalledModels(): Promise<T_InstalledTextModel[]>;
}
declare const obrewClient: ObrewClient;

declare const DEFAULT_OBREW_CONFIG: I_ObrewConfig;

export { AGENT_RETRIEVAL_METHOD, AUGMENTED_RETRIEVAL_METHOD, BASE_RETRIEVAL_METHOD, DEFAULT_CONVERSATION_MODE, DEFAULT_OBREW_CONFIG, DEFAULT_RETRIEVAL_METHOD, DEFAULT_TOOL_RESPONSE_MODE, DEFAULT_TOOL_USE_MODE, type I_API, type I_Attention_State, type I_BaseServiceApis, type I_ChunkMetadata, type I_Collection, type I_ConnectResponse, type I_DeleteTextModelReqPayload, type I_DocumentChunk, type I_Endpoint, type I_GenericAPIRequestParams, type I_GenericAPIResponse, type I_InferenceGenerateOptions, type I_Knowledge_State, type I_LLM_Call_Options, type I_LLM_Init_Options, type I_LLM_Options, type I_LoadTextModelRequestPayload, type I_LoadedModelRes, type I_Message, type I_ModelConfigs, type I_Model_State, type I_NonStreamChatbotResponse, type I_NonStreamPlayground, type I_PromptTemplates, type I_Prompt_State, type I_RAG_Strat_State, type I_Response_State, type I_ServiceApis, type I_ServicesResponse, type I_Source, type I_System_State, type I_Text_Settings, type I_Thread, type I_ToolFunctionSchemaRes, type I_ToolSchemaReqPayload, type I_Tool_Def_Parameter, type I_Tool_Definition, type I_Tool_Parameter, type I_Tools_Inference_State, type Message, ModelID, NATIVE_TOOL_USE, type T_APIConfigOptions, type T_ConversationMode, type T_DeleteChatThreadAPIRequest, type T_Endpoint, type T_GenericAPIRequest, type T_GenericDataRes, type T_GenericReqPayload, type T_GetChatThreadAPIRequest, type T_InputOptionTypes, type T_InstalledTextModel, type T_LLM_InferenceOptions, type T_ModelConfig, type T_PromptTemplate, type T_SaveChatThreadAPIRequest, type T_SystemPrompt, type T_SystemPrompts, type T_TextInferenceAPIRequest, type T_ToolResponseMode, type T_ToolSchemaType, type T_ToolUseMode, type T_Tool_Param_Option, UNIVERSAL_TOOL_USE, obrewClient as client };
