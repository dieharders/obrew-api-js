# Obrew API JS

A TypeScript/JavaScript library providing React hooks and API clients for interacting with the Homebrew AI backend services.

## Features

- 🎣 React hooks for easy integration
- 🤖 Text inference API with streaming support
- 🧠 Memory/RAG (Retrieval-Augmented Generation) management
- 🛠️ Tool function management and execution
- 💾 Storage and persistence layer
- 📦 Full TypeScript support with comprehensive type definitions
- 🔄 Automatic connection management

## Installation

```bash
npm install obrew-api-js
```

## Quick Start

```typescript
import { useHomebrew } from 'obrew-api-js'

function App() {
  const { connect, getServices } = useHomebrew()

  useEffect(() => {
    async function init() {
      // Connect to the Homebrew backend
      const connection = await connect()

      if (connection?.success) {
        // Get API services
        const services = await getServices()
        console.log('Connected to Homebrew API', services)
      }
    }

    init()
  }, [connect, getServices])

  return <div>Your App</div>
}
```

## API Services

### Text Inference

Generate text using LLM models with streaming or non-streaming responses:

```typescript
const services = await getServices()

// Load a model
await services.textInference.load({
  body: {
    modelPath: '/path/to/model',
    modelId: 'my-model',
    init: {
      n_ctx: 2048,
      n_threads: 4
    },
    call: {
      temperature: 0.7,
      max_tokens: 512
    }
  }
})

// Generate text
const response = await services.textInference.generate({
  body: {
    messages: [{ role: 'user', content: 'Hello!' }],
    responseMode: 'chat'
  },
  signal: abortController.signal
})
```

### Memory Management

Add and manage document collections for RAG:

```typescript
// Add a document to a collection
await services.memory.addDocument({
  body: {
    collectionId: 'my-collection',
    documents: [...]
  }
})

// Get all collections
const collections = await services.memory.getAllCollections()

// Query chunks
const chunks = await services.memory.getChunks({
  queryParams: { collectionId: 'my-collection' }
})
```

### Tool Management

Register and execute custom tool functions:

```typescript
// Get available tool functions
const tools = await services.storage.getToolFunctions()

// Get tool schema
const schema = await services.storage.getToolSchema({
  queryParams: { filename: 'my_tool.py' }
})

// Save tool settings
await services.storage.saveToolSettings({
  body: {
    tools: [...]
  }
})
```

### Storage

Persist bot settings and chat threads:

```typescript
// Save bot settings
await services.storage.saveBotSettings({
  body: {
    settings: {...}
  }
})

// Save chat thread
await services.storage.saveChatThread({
  body: {
    threadId: 'thread-123',
    thread: {...}
  }
})

// Get chat threads
const threads = await services.storage.getChatThread({
  queryParams: { threadId: 'thread-123' }
})
```

## Configuration

Configure the backend connection using the `appSettings` helper:

```typescript
import appSettings from '@/lib/localStorage'

// Set host connection
appSettings.setHostConnection({
  domain: 'http://localhost',
  port: '8008'
})
```

Default configuration:
- **Domain**: `http://localhost`
- **Port**: `8008`

## Type Definitions

The library exports comprehensive TypeScript types for all API interactions:

```typescript
import type {
  I_ServiceApis,
  I_Text_Settings,
  I_Collection,
  I_Thread,
  I_Tool_Definition,
  // ... and many more
} from 'obrew-api-js'
```

## Error Handling

All API methods return responses with the following structure:

```typescript
interface I_GenericAPIResponse<DataResType> {
  success: boolean
  message: string
  data: DataResType
}
```

Handle errors appropriately:

```typescript
try {
  const result = await services.textInference.generate({ body: {...} })

  if (!result.success) {
    console.error('Error:', result.message)
  }
} catch (error) {
  console.error('Request failed:', error)
}
```

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
