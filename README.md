# Obrew JS API

A TypeScript/JavaScript API library providing React hooks for interacting with the Obrew AI backend services.

Used to interact with Obrew Studio: Server https://github.com/dieharders/obrew-studio-server
And used by the Obrew Studio WebUI https://github.com/dieharders/brain-dump

## Features

- 🎣 React hooks for easy integration
- 🤖 Text Inference/Memory/RAG API with streaming support
- 🛠️ Tool function management and execution
- 💾 Storage and persistence layer
- 📦 Full TypeScript support with comprehensive type definitions
- 🔄 Automatic connection management
- 🌲 Tree-shakable exports for optimal bundle size
- ⚡ Built with tsup for fast, modern builds
- 🎯 ESM and CommonJS support

## Installation

### As a Git Submodule

Use Git Submodules for pulling client API code into other projects:

```bash
# In your consuming project
git submodule add https://github.com/yourusername/obrew-api-js.git lib/obrew-api-js
git submodule update --init --recursive
```

### Development Setup

After cloning or adding as a submodule:

```bash
cd obrew-api-js
npm install
npm run build
```

## Quick Start

### React Hook Usage

```typescript
import { useObrew } from 'obrew-api-js'

function App() {
  const { connect, getServices } = useObrew()

  useEffect(() => {
    async function init() {
      // Connect to the Obrew backend
      const connection = await connect()

      if (connection?.success) {
        // Get API services
        const { serviceApis } = await getServices()
        console.log('Connected to Obrew API', serviceApis)
      }
    }

    init()
  }, [connect, getServices])

  return <div>Your App</div>
}
```

### Standalone Usage (Non-React)

```typescript
import { getAPIConfig, createServices, setHostConnection } from "obrew-api-js";

// Configure connection
setHostConnection({
  domain: "http://localhost",
  port: "8008",
});

// Get services
const config = await getAPIConfig();
const services = createServices(config);

// Use the API
if (services) {
  const response = await services.textInference.generate({
    body: {
      messages: [{ role: "user", content: "Hello!" }],
      responseMode: "chat",
    },
    signal: abortController.signal,
  });
}
```

## API Services

### Text Inference

Generate text using LLM models with streaming or non-streaming responses:

```typescript
const services = await getServices();

// Load a model
await services.textInference.load({
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

// Generate text
const response = await services.textInference.generate({
  body: {
    messages: [{ role: "user", content: "Hello!" }],
    responseMode: "chat",
  },
  signal: abortController.signal,
});
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

Configure the backend connection using the `setHostConnection` utility:

```typescript
import { setHostConnection, getHostConnection } from "obrew-api-js";

// Set host connection
setHostConnection({
  domain: "http://localhost",
  port: "8008",
});

// Get current connection settings
const currentConnection = getHostConnection();
console.log(currentConnection); // { domain: 'http://localhost', port: '8008' }
```

Default configuration:

- **Domain**: `http://localhost`
- **Port**: `8008`

## Development

### Scripts

- `npm run build` - Build the library for production
- `npm run dev` - Build in watch mode for development
- `npm run lint` - Lint the source code
- `npm run lint:fix` - Lint and fix issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking

### Project Structure

```
obrew-api-js/
├── src/
│   ├── index.ts      # Barrel exports (main entry point)
│   ├── api.ts        # Core API client functions
│   ├── hooks.ts      # React hooks
│   ├── types.ts      # TypeScript type definitions
│   └── utils.ts      # Utility functions
├── dist/             # Build output (generated)
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
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
} from "obrew-api-js";
```

## Error Handling

All API methods return responses with the following structure:

```typescript
interface I_GenericAPIResponse<DataResType> {
  success: boolean;
  message: string;
  data: DataResType;
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

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
