type Message = {
    id: string;
    createdAt?: Date | undefined;
    content: string;
    role: 'system' | 'user' | 'assistant';
};
interface I_Message {
    id: string;
    content: string;
    role: 'system' | 'user' | 'assistant';
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
    mmprojPath?: string;
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
type T_EmbeddingModelConfig = {
    repoId: string;
    modelName: string;
    description?: string;
    dimensions?: number;
    maxTokens?: number;
};
type T_InstalledEmbeddingModel = {
    repoId: string;
    modelName: string;
    savePath: string;
    size: number;
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
declare const TOOL_RESPONSE_MODE_RESULT = "result";
declare const BASE_RETRIEVAL_METHOD = "base";
declare const AUGMENTED_RETRIEVAL_METHOD = "augmented";
declare const AGENT_RETRIEVAL_METHOD = "agent";
declare const DEFAULT_RETRIEVAL_METHOD = "base";
declare const NATIVE_TOOL_USE = "native";
declare const UNIVERSAL_TOOL_USE = "universal";
declare const DEFAULT_TOOL_USE_MODE = "universal";
declare const STRATEGY_REFINE = "refine";
declare const STRATEGY_COMPACT = "compact";
declare const STRATEGY_SIMPLE_SUMMARIZE = "simple_summarize";
declare const STRATEGY_TREE_SUMMARIZE = "tree_summarize";
declare const STRATEGY_NO_TEXT = "no_text";
declare const STRATEGY_CONTEXT_ONLY = "context_only";
declare const STRATEGY_ACCUMULATE = "accumulate";
declare const STRATEGY_COMPACT_ACCUMULATE = "compact_accumulate";
type T_ConversationMode = 'instruct' | 'chat' | 'collab';
type T_ToolResponseMode = 'answer' | 'result';
type T_ToolUseMode = typeof UNIVERSAL_TOOL_USE | typeof NATIVE_TOOL_USE;
type T_ToolSchemaType = 'json' | 'typescript';
type T_ResponseStrategy = typeof STRATEGY_REFINE | typeof STRATEGY_COMPACT | typeof STRATEGY_SIMPLE_SUMMARIZE | typeof STRATEGY_TREE_SUMMARIZE | typeof STRATEGY_NO_TEXT | typeof STRATEGY_CONTEXT_ONLY | typeof STRATEGY_ACCUMULATE | typeof STRATEGY_COMPACT_ACCUMULATE;
interface I_InferenceGenerateOptions extends T_LLM_InferenceOptions {
    responseMode?: T_ConversationMode;
    toolResponseMode?: T_ToolResponseMode;
    toolUseMode?: T_ToolUseMode;
    messageFormatOverride?: string;
    memory?: I_Knowledge_State;
    tools?: string[];
    similarity_top_k?: number;
    strategy?: T_ResponseStrategy;
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
type T_InputOptionTypes = 'options-sel' | 'options-multi' | 'options-button' | 'text' | 'text-multi';
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
    json_schema?: string | undefined;
    typescript_schema?: string | undefined;
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
interface I_ConnectionConfig {
    protocol: string;
    domain: string;
    port: string;
    version: string;
    enabled: boolean;
}
interface I_Connection {
    config: I_ConnectionConfig;
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
interface I_HardwareInfo {
    gpu_type: string;
    gpu_name: string;
    driver_ver: string;
    manufacturer: string;
    dac_type: string;
    pnp_device_id: string;
    id?: number;
    vram_total?: number;
    vram_used?: number;
    vram_free?: number;
}
interface I_HardwareAuditResponse {
    success: boolean;
    message: string;
    data: I_HardwareInfo[];
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
    tool_name: string;
}
interface I_DownloadEmbeddingModelPayload {
    repo_id: string;
    filename: string;
}
interface I_DeleteEmbeddingModelPayload {
    repoId: string;
}
interface I_GetEmbedModelInfoPayload {
    repoId: string;
}
interface I_VisionGenerateRequest {
    prompt: string;
    images: string[];
    image_type?: 'base64' | 'path';
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
}
interface I_VisionGenerateResponse {
    text: string;
    finish_reason?: string;
}
interface I_LoadVisionModelRequest {
    modelPath: string;
    mmprojPath: string;
    modelId: string;
    init: I_LLM_Init_Options;
    call: I_LLM_Call_Options;
}
interface I_DownloadMmprojPayload {
    repo_id: string;
    filename: string;
    model_repo_id: string;
}
interface I_VisionEmbedLoadRequest {
    model_path: string;
    mmproj_path: string;
    model_name?: string;
    model_id?: string;
    port?: number;
    n_gpu_layers?: number;
    n_threads?: number;
    n_ctx?: number;
}
interface I_VisionEmbedLoadResponse {
    model_name: string;
    model_id: string;
    port: number;
}
interface I_VisionEmbedRequest {
    image_path?: string;
    image_base64?: string;
    image_type?: 'path' | 'base64';
    collection_name?: string;
    include_transcription?: boolean;
    transcription_prompt?: string;
}
interface I_VisionEmbedResponse {
    id: string;
    collection_name: string;
    embedding_dim: number;
    transcription?: string;
    stored: boolean;
    metadata?: Record<string, any>;
}
interface I_VisionEmbedModelInfo {
    model_name: string;
    model_id: string;
    port: number;
    is_running: boolean;
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
        auditHardware: T_GenericAPIRequest<T_GenericReqPayload, I_HardwareInfo[]>;
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
        downloadEmbedModel: T_GenericAPIRequest<I_DownloadEmbeddingModelPayload, T_GenericDataRes>;
        installedEmbedModels: T_GenericAPIRequest<T_GenericReqPayload, T_InstalledEmbeddingModel[]>;
        availableEmbedModels: T_GenericAPIRequest<T_GenericReqPayload, T_EmbeddingModelConfig[]>;
        deleteEmbedModel: T_GenericAPIRequest<I_DeleteEmbeddingModelPayload, T_GenericDataRes>;
        getEmbedModelInfo: T_GenericAPIRequest<I_GetEmbedModelInfoPayload, T_GenericDataRes>;
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
    visionInference: {
        load: T_GenericAPIRequest<I_LoadVisionModelRequest, T_GenericDataRes>;
        unload: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        generate: T_GenericAPIRequest<I_VisionGenerateRequest, I_VisionGenerateResponse>;
    };
    visionEmbed: {
        load: T_GenericAPIRequest<I_VisionEmbedLoadRequest, I_VisionEmbedLoadResponse>;
        unload: T_GenericAPIRequest<T_GenericReqPayload, T_GenericDataRes>;
        embed: T_GenericAPIRequest<I_VisionEmbedRequest, I_VisionEmbedResponse>;
        model: T_GenericAPIRequest<T_GenericReqPayload, I_VisionEmbedModelInfo>;
    };
}

declare class ObrewClient {
    private hasConnected;
    private abortController;
    private connection;
    isConnected(): boolean;
    getConnection(): I_Connection;
    connect({ config, signal, }: {
        config: I_ConnectionConfig;
        signal?: AbortSignal;
    }): Promise<boolean>;
    ping(timeout?: number): Promise<{
        success: boolean;
        responseTime?: number;
        error?: string;
    }>;
    cancelRequest(): void;
    disconnect(): void;
    private handlePotentialConnectionError;
    private extractTextFromResponse;
    private handleStreamResponse;
    sendMessage(messages: Message[], options?: Partial<I_InferenceGenerateOptions>, setEventState?: (ev: string) => void): Promise<string>;
    onStreamEvent(eventName: string): void;
    stopChat(): void;
    installModel(repoId: string, filename?: string): Promise<string>;
    uninstallModel(repoId: string, filename: string): Promise<void>;
    loadModel({ modelPath, modelId, modelSettings, }: {
        modelPath: string;
        modelId: string;
        modelSettings: I_Text_Settings;
    }): Promise<void>;
    unloadModel(): Promise<void>;
    getLoadedModel(): Promise<I_LoadedModelRes | null>;
    getInstalledModels(): Promise<T_InstalledTextModel[]>;
    saveAgentConfig(config: I_Text_Settings): Promise<I_Text_Settings[]>;
    getAgentConfig(botName: string): Promise<I_Text_Settings | null>;
    deleteAgentConfig(botName: string): Promise<I_Text_Settings[]>;
    auditHardware(): Promise<I_HardwareInfo[]>;
    installEmbeddingModel(repoId: string, filename: string): Promise<string>;
    getInstalledEmbeddingModels(): Promise<T_InstalledEmbeddingModel[]>;
    getAvailableEmbeddingModels(): Promise<T_EmbeddingModelConfig[]>;
    deleteEmbeddingModel(repoId: string): Promise<string>;
    getEmbeddingModelInfo(repoId: string): Promise<any>;
    loadVisionModel({ modelPath, mmprojPath, modelId, modelSettings, }: {
        modelPath: string;
        mmprojPath: string;
        modelId: string;
        modelSettings: {
            init: I_LLM_Init_Options;
            call: I_LLM_Call_Options;
        };
    }): Promise<void>;
    unloadVisionModel(): Promise<void>;
    transcribeImage(images: string[], prompt?: string, options?: {
        max_tokens?: number;
        temperature?: number;
    }): Promise<string>;
    loadVisionEmbedModel(options: I_VisionEmbedLoadRequest): Promise<I_VisionEmbedLoadResponse>;
    unloadVisionEmbedModel(): Promise<void>;
    createImageEmbedding(options: I_VisionEmbedRequest): Promise<I_VisionEmbedResponse>;
    getVisionEmbedModelInfo(): Promise<I_VisionEmbedModelInfo | null>;
}
declare const obrewClient: ObrewClient;

declare const DEFAULT_OBREW_CONFIG: I_ConnectionConfig;

export { AGENT_RETRIEVAL_METHOD, AUGMENTED_RETRIEVAL_METHOD, BASE_RETRIEVAL_METHOD, DEFAULT_CONVERSATION_MODE, DEFAULT_OBREW_CONFIG, DEFAULT_RETRIEVAL_METHOD, DEFAULT_TOOL_RESPONSE_MODE, DEFAULT_TOOL_USE_MODE, type I_API, type I_Attention_State, type I_BaseServiceApis, type I_ChunkMetadata, type I_Collection, type I_ConnectResponse, type I_Connection, type I_ConnectionConfig, type I_DeleteEmbeddingModelPayload, type I_DeleteTextModelReqPayload, type I_DocumentChunk, type I_DownloadEmbeddingModelPayload, type I_DownloadMmprojPayload, type I_Endpoint, type I_GenericAPIRequestParams, type I_GenericAPIResponse, type I_GetEmbedModelInfoPayload, type I_HardwareAuditResponse, type I_HardwareInfo, type I_InferenceGenerateOptions, type I_Knowledge_State, type I_LLM_Call_Options, type I_LLM_Init_Options, type I_LLM_Options, type I_LoadTextModelRequestPayload, type I_LoadVisionModelRequest, type I_LoadedModelRes, type I_Message, type I_ModelConfigs, type I_Model_State, type I_NonStreamChatbotResponse, type I_NonStreamPlayground, type I_PromptTemplates, type I_Prompt_State, type I_RAG_Strat_State, type I_Response_State, type I_ServiceApis, type I_ServicesResponse, type I_Source, type I_System_State, type I_Text_Settings, type I_Thread, type I_ToolFunctionSchemaRes, type I_ToolSchemaReqPayload, type I_Tool_Def_Parameter, type I_Tool_Definition, type I_Tool_Parameter, type I_Tools_Inference_State, type I_VisionEmbedLoadRequest, type I_VisionEmbedLoadResponse, type I_VisionEmbedModelInfo, type I_VisionEmbedRequest, type I_VisionEmbedResponse, type I_VisionGenerateRequest, type I_VisionGenerateResponse, type Message, ModelID, NATIVE_TOOL_USE, TOOL_RESPONSE_MODE_RESULT, type T_APIConfigOptions, type T_ConversationMode, type T_DeleteChatThreadAPIRequest, type T_EmbeddingModelConfig, type T_Endpoint, type T_GenericAPIRequest, type T_GenericDataRes, type T_GenericReqPayload, type T_GetChatThreadAPIRequest, type T_InputOptionTypes, type T_InstalledEmbeddingModel, type T_InstalledTextModel, type T_LLM_InferenceOptions, type T_ModelConfig, type T_PromptTemplate, type T_SaveChatThreadAPIRequest, type T_SystemPrompt, type T_SystemPrompts, type T_TextInferenceAPIRequest, type T_ToolResponseMode, type T_ToolSchemaType, type T_ToolUseMode, type T_Tool_Param_Option, UNIVERSAL_TOOL_USE, obrewClient as client };
