# Obrew JS API

> [!WARNING]
> 🚧 This project is currently under active development. APIs and features may change without notice. 🚧

A TypeScript/JavaScript API library providing React hooks for interacting with the Obrew AI backend services.

Used to interact with Obrew Studio: Server https://github.com/dieharders/obrew-studio-server

Used by Obrew Studio: WebUI https://github.com/dieharders/brain-dump

## Features

- 🎣 React hooks for easy integration
- 🤖 Text Inference/RAG API with streaming support
- 🛠️ Tool function management and execution
- 💾 Storage and persistence layer
- 📦 Full TypeScript support
- 🔄 Automatic connection management
- 🌲 Tree-shakable exports
- ⚡ Built with tsup for fast builds
- 🎯 ESM and CommonJS support

## Installation

### As a Git Submodule

Use Git Submodules for pulling code into other projects.
For example in root of your project, `path/to/submodule` == `src/lib/obrew-api-js`.

#### Install Git Submodule

```bash
# In your consuming project
git submodule add https://github.com/dieharders/obrew-api-js.git path/to/submodule
git submodule update --init --recursive
# Commit the resulting .gitmodules file and "special" git folder that was created
```

#### Update Git Submodule

```bash
git submodule update --remote path/to/submodule
```

#### Remove Git Submodule

```bash
# Remove the submodule entry from .git/config
git submodule deinit -f path/to/submodule
# Remove the submodule directory from .git/modules/
rm -rf .git/modules/path/to/submodule
# Remove the submodule from the working tree and index
git rm -f path/to/submodule
```

### Development Setup

For development or when modifying source code:

```bash
cd obrew-api-js
pnpm install
# Build source and commit to version control.
# Code in `/dist` will be used by consuming apps.
pnpm build
```

**Note:** When using this as a git submodule in your consuming project, the files in `/dist` are already built. You can use them directly without installing dependencies or building.

### Scripts

- `pnpm build` - Build the library for production
- `pnpm dev` - Build in watch mode for development
- `pnpm lint` - Lint the source code
- `pnpm lint:fix` - Lint and fix issues automatically
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting
- `pnpm type-check` - Run TypeScript type checking

### Project Structure

```
obrew-api-js/
├── src/
│   ├── index.ts      # Barrel exports (main entry point)
│   ├── api.ts        # Core API client functions
│   ├── client.ts     # Client helper functions
│   ├── types.ts      # TypeScript type definitions
│   └── utils.ts      # Utility functions
├── dist/             # Build output (generated)
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

## Quick Start

### React Hook Usage

```typescript
import { useObrew } from 'obrew-api-js'
import { useEffect } from 'react'

function App() {
  const { connect, getServices } = useObrew()

  useEffect(() => {
    async function init() {
      // Connect to the Obrew backend
      const connection = await connect()

      if (connection?.success) {
        // Get API services with configuration options
        const { serviceApis, configOptions } = await getServices()
        console.log('Connected to Obrew API', serviceApis)
        console.log('API Config:', configOptions)
      }
    }

    init()
  }, [connect, getServices])

  return <div>Your App</div>
}
```

### Standalone Usage (Non-React)

```typescript
import { getAPIConfig, createServices, setHostConnection } from 'obrew-api-js'

// Configure connection (optional - defaults to http://localhost:8008)
setHostConnection({
  domain: 'http://localhost',
  port: '8008',
})

// Get API configuration from backend
const apiConfig = await getAPIConfig()

// Create service API clients
const services = createServices(apiConfig)

// Use the API services
if (services) {
  const response = await services.textInference.generate({
    body: {
      messages: [{ role: 'user', content: 'Hello!' }],
      responseMode: 'chat',
    },
    signal: new AbortController().signal,
  })

  console.log(response)
}
```

## Configuration

Configure the backend connection using the `setHostConnection` utility:

```typescript
import { setHostConnection, getHostConnection } from 'obrew-api-js'

// Set host connection
setHostConnection({
  domain: 'http://localhost',
  port: '8008',
})

// Get current connection settings
const currentConnection = getHostConnection()
console.log(currentConnection) // { domain: 'http://localhost', port: '8008' }
```

Default configuration:

- **Domain**: `http://localhost`
- **Port**: `8008`

## API Services

The library dynamically creates service API clients based on the backend configuration. Common services include:

### Text Inference

Generate text using LLM models with streaming or non-streaming responses:

```typescript
const { serviceApis } = await getServices();

// Load a model
await serviceApis.textInference.load({
  body: {
    modelPath: "/path/to/model",
    modelId: "my-model",
    init: {
      n_ctx: 2048,
      n_threads: 4,
    },
    call: {
      temperature: 0.7,
      max_tokens: 512,
    },
  },
});

// Generate text (non-streaming)
const response = await serviceApis.textInference.generate({
  body: {
    messages: [{ role: "user", content: "Hello!" }],
    responseMode: "chat",
  },
  signal: new AbortController().signal,
});

// For streaming responses, the raw `Response` object is returned. Check the content-type header to determine if the response is a stream:
const response = await serviceApis.textInference.generate({ body: {...} })

const contentType = response.headers.get('content-type')
if (contentType?.includes('event-stream')) {
  // Handle streaming response
  const reader = response.body?.getReader()
  // Process stream...
} else {
  // Handle JSON response
  const data = await response.json()
}
```

### Memory Management

Add and manage document collections for RAG (Retrieval-Augmented Generation):

```typescript
// Add a document to a collection
await serviceApis.memory.addDocument({
  body: {
    collectionId: 'my-collection',
    documents: [
      /* document objects */
    ],
  },
})

// Get all collections
const collections = await serviceApis.memory.getAllCollections()

// Query chunks
const chunks = await serviceApis.memory.getChunks({
  queryParams: { collectionId: 'my-collection' },
})
```

### Tool Management

Manage and execute custom tool functions for AI agent capabilities:

```typescript
// Get available tool functions
const tools = await serviceApis.storage.getToolFunctions()

// Get tool schema for a specific tool file
const schema = await serviceApis.storage.getToolSchema({
  queryParams: { filename: 'my_tool.py' },
})

// Save tool settings
await serviceApis.storage.saveToolSettings({
  body: {
    tools: [
      /* tool configuration objects */
    ],
  },
})
```

### Storage

Persist bot settings and chat threads:

```typescript
// Save bot settings
await serviceApis.storage.saveBotSettings({
  body: {
    settings: {
      /* bot configuration */
    },
  },
})

// Save chat thread
await serviceApis.storage.saveChatThread({
  body: {
    threadId: 'thread-123',
    thread: {
      /* thread data */
    },
  },
})

// Get chat threads
const threads = await serviceApis.storage.getChatThread({
  queryParams: { threadId: 'thread-123' },
})

// Delete a chat thread
await serviceApis.storage.deleteChatThread({
  queryParams: { threadId: 'thread-123' },
})
```

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

All API methods return responses with a consistent structure:

```typescript
interface I_GenericAPIResponse<DataResType> {
  success: boolean
  message: string
  data: DataResType
}
```

The library handles errors internally and returns them in a standardized format:

```typescript
try {
  const result = await serviceApis.textInference.generate({
    body: {
      messages: [{ role: 'user', content: 'Hello!' }],
      responseMode: 'chat',
    },
  })

  if (result.success) {
    console.log('Response:', result.data)
  } else {
    console.error('API Error:', result.message)
  }
} catch (error) {
  // Network or unexpected errors
  console.error('Request failed:', error)
}
```
