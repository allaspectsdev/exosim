# ExoSim

**Exo Cluster Simulator** — A TypeScript service that simulates an [Exo](https://github.com/exo-explore/exo) distributed AI inference cluster, proxying all requests to Claude via the Anthropic API.

Build and test applications that integrate with Exo clusters without needing actual Mac hardware.

---

## What is this?

[Exo](https://github.com/exo-explore/exo) is a framework that pools Apple Silicon Macs into a distributed AI inference cluster, exposing OpenAI-compatible, Claude Messages, and Ollama APIs. ExoSim replicates Exo's full API surface so you can develop against it using a frontier LLM (Claude Opus 4.6) as the backend.

```
Your App  ──→  ExoSim (port 52415)  ──→  Anthropic API (Claude Opus 4.6)
               │
               ├── OpenAI-compatible API
               ├── Claude Messages API
               ├── Ollama API
               ├── Cluster state simulation
               └── mDNS discovery (optional)
```

**Key features:**
- Drop-in replacement for a real Exo cluster during development
- All three API formats: OpenAI, Claude Messages, and Ollama
- Full streaming support (SSE and NDJSON)
- Simulated multi-node cluster topology with realistic hardware specs
- Instance management, model registry, and cluster state endpoints
- Optional mDNS advertisement for automatic client discovery
- Any model name accepted — all transparently routed to Claude

---

## Quick Start

```bash
# Clone
git clone https://github.com/allaspectsdev/exosim.git
cd exosim

# Install
npm install

# Configure
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run (development with hot reload)
npm run dev

# Or build and run in production
npm run build
npm start
```

ExoSim starts on port **52415** (Exo's default port) and displays:

```
╔══════════════════════════════════════════════╗
║               ExoSim v0.1.0                  ║
║     Exo Cluster Simulator → Claude Opus      ║
╠══════════════════════════════════════════════╣
║  Port:        52415                          ║
║  Model:       claude-opus-4-6                ║
║  Nodes:       3                              ║
║  Master:      exosim-alpha                   ║
╚══════════════════════════════════════════════╝
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-opus-4-6` | Claude model to proxy to |
| `PORT` | `52415` | Server port (matches Exo default) |
| `SIMULATED_NODE_COUNT` | `3` | Number of simulated cluster nodes |
| `ENABLE_MDNS` | `false` | Advertise via mDNS for auto-discovery |
| `DEFAULT_MAX_TOKENS` | `4096` | Default max tokens when client doesn't specify |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |

---

## API Reference

ExoSim implements all of Exo's API endpoints. Every inference request is transparently proxied to Claude — the model name in your request is accepted but ignored for routing.

### OpenAI Chat Completions

```bash
# Non-streaming
curl http://localhost:52415/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 256
  }'

# Streaming
curl http://localhost:52415/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

**Supported fields:** `model`, `messages`, `temperature`, `top_p`, `top_k`, `max_tokens`, `stop`, `stream`, `tools`, `tool_choice`, `reasoning_effort`, `frequency_penalty`, `presence_penalty`, `seed`

Works with the OpenAI Python and Node.js SDKs:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:52415/v1", api_key="unused")
response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

```typescript
import OpenAI from "openai";

const client = new OpenAI({ baseURL: "http://localhost:52415/v1", apiKey: "unused" });
const response = await client.chat.completions.create({
  model: "llama-3.3-70b",
  messages: [{ role: "user", content: "Hello!" }],
});
console.log(response.choices[0].message.content);
```

### Claude Messages API

```bash
curl http://localhost:52415/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.3-70b",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Supported fields:** `model`, `messages`, `max_tokens`, `system`, `temperature`, `top_p`, `top_k`, `stop_sequences`, `stream`, `tools`, `tool_choice`, `thinking`

Works with the Anthropic SDK:

```python
from anthropic import Anthropic

client = Anthropic(base_url="http://localhost:52415", api_key="unused")
message = client.messages.create(
    model="llama-3.3-70b",
    max_tokens=256,
    messages=[{"role": "user", "content": "Hello!"}]
)
print(message.content[0].text)
```

### Ollama API

```bash
# Chat
curl http://localhost:52415/ollama/api/chat \
  -d '{"model": "llama-3.3-70b", "messages": [{"role": "user", "content": "Hello!"}]}'

# Generate
curl http://localhost:52415/ollama/api/generate \
  -d '{"model": "llama-3.3-70b", "prompt": "Hello!"}'

# List models
curl http://localhost:52415/ollama/api/tags

# Model details
curl http://localhost:52415/ollama/api/show \
  -d '{"model": "llama-3.3-70b"}'
```

**Endpoints:** `POST /ollama/api/chat`, `POST /ollama/api/generate`, `GET /ollama/api/tags`, `GET /ollama/api/ps`, `POST /ollama/api/show`, `GET /ollama/api/version`

### Model Listing

```bash
# OpenAI format
curl http://localhost:52415/v1/models

# Exo format
curl http://localhost:52415/models

# Search
curl "http://localhost:52415/models/search?q=llama"

# Ollama format
curl http://localhost:52415/ollama/api/tags
```

**Pre-registered models:** `llama-3.2-1b`, `llama-3.2-3b`, `llama-3.3-70b`, `deepseek-r1`, `deepseek-r1-0528`, `qwen2.5-72b`, `qwen3-235b`, `mistral-nemo`, `mistral-small-3.1`, `gemma-2-27b`, `phi-4`

Any model name not in the registry is still accepted — ExoSim logs a warning and proxies to Claude regardless.

### Cluster State & Management

```bash
# Node ID (master node UUID)
curl http://localhost:52415/node_id

# Full cluster state (topology, nodes, instances)
curl http://localhost:52415/state

# SSE event stream
curl http://localhost:52415/events

# Onboarding status
curl http://localhost:52415/onboarding
```

### Instance Management

```bash
# Create instance
curl -X POST http://localhost:52415/instance \
  -H "Content-Type: application/json" \
  -d '{"model_id": "llama-3.3-70b"}'

# Get instance
curl http://localhost:52415/instance/{instance_id}

# Delete instance
curl -X DELETE http://localhost:52415/instance/{instance_id}

# Placement recommendations
curl "http://localhost:52415/instance/placement?model_id=llama-3.3-70b"

# Placement previews
curl http://localhost:52415/instance/previews
```

### Other Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Service info and status |
| `GET /bench/` | Performance metrics |
| `GET /v1/traces` | Execution traces |
| `GET /v1/traces/:taskId/stats` | Trace statistics |
| `POST /v1/cancel/:commandId` | Cancel a task |
| `POST /v1/images/generations` | Returns 501 (not supported) |
| `POST /v1/images/edits` | Returns 501 (not supported) |

---

## Streaming

ExoSim supports streaming for all three API formats:

| API | Format | Content-Type |
|-----|--------|--------------|
| OpenAI `/v1/chat/completions` | Server-Sent Events (SSE) | `text/event-stream` |
| Claude `/v1/messages` | Server-Sent Events (SSE) | `text/event-stream` |
| Ollama `/ollama/api/chat` | Newline-delimited JSON (NDJSON) | `application/x-ndjson` |

### OpenAI SSE format
```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0,"finish_reason":null}]}

data: [DONE]
```

### Claude SSE format
```
event: message_start
data: {"type":"message_start","message":{...}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: message_stop
data: {"type":"message_stop"}
```

### Ollama NDJSON format
```json
{"model":"llama-3.3-70b","created_at":"...","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"llama-3.3-70b","created_at":"...","message":{"role":"assistant","content":""},"done":true,"total_duration":...}
```

---

## Cluster Simulation

ExoSim generates a realistic cluster topology at startup:

- **Nodes**: Configurable count (default 3) with randomized Apple Silicon specs (M1–M4 Pro/Max/Ultra)
- **Topology**: Ring topology with random extra edges, socket and RDMA connection types
- **Master election**: First node is always master
- **Instance management**: Create/delete model instances with simulated shard assignments across nodes
- **Events**: SSE stream with topology events and 30-second heartbeat

Example `/state` response:
```json
{
  "topology": {
    "nodes": [
      {
        "nodeId": "uuid-...",
        "name": "exosim-alpha",
        "isMaster": true,
        "cpu": { "cores": 12, "model": "M4 Max", "usagePercent": 15.2 },
        "memory": { "totalGb": 96, "usedGb": 28.4 },
        "gpu": { "model": "Apple M4 Max", "vramGb": 48, "usagePercent": 8.1 }
      }
    ],
    "edges": [
      { "from": "uuid-a", "to": "uuid-b", "type": "socket" }
    ]
  },
  "masterNodeId": "uuid-...",
  "connectedNodes": ["uuid-a", "uuid-b", "uuid-c"],
  "instances": {}
}
```

---

## mDNS Discovery

When `ENABLE_MDNS=true`, ExoSim advertises itself as `_exo._tcp` on the local network, allowing Exo-aware clients to auto-discover it.

Requires the optional `multicast-dns` package:
```bash
npm install multicast-dns
```

---

## Architecture

```
src/
├── index.ts                  # Entry point
├── config.ts                 # Environment configuration
├── server.ts                 # Fastify app + route registration
├── anthropic/
│   ├── client.ts             # Anthropic SDK singleton
│   └── proxy.ts              # Core proxy (stream + sync)
├── adapters/
│   ├── openai.ts             # OpenAI → Anthropic conversion
│   ├── claude.ts             # Claude passthrough (model override)
│   └── ollama.ts             # Ollama → Anthropic conversion
├── routes/
│   ├── openai.ts             # /v1/chat/completions
│   ├── claude.ts             # /v1/messages
│   ├── ollama.ts             # /ollama/api/*
│   ├── models.ts             # /models, /v1/models
│   └── cluster.ts            # /node_id, /state, /events, /instance/*
├── streaming/
│   ├── openai-sse.ts         # OpenAI SSE formatter
│   ├── claude-sse.ts         # Claude SSE formatter
│   └── ollama-ndjson.ts      # Ollama NDJSON formatter
├── state/
│   ├── cluster.ts            # Simulated topology & nodes
│   ├── models.ts             # Model registry & name mapping
│   └── instances.ts          # Instance CRUD
├── mdns/
│   └── advertiser.ts         # Optional mDNS advertisement
└── types/
    ├── openai.ts             # OpenAI interfaces
    ├── claude.ts             # Claude Messages interfaces
    ├── ollama.ts             # Ollama interfaces
    └── cluster.ts            # Cluster state types
```

**Design principle:** All three API formats funnel through a single Anthropic proxy function. Adapters convert incoming requests to Anthropic's `MessageCreateParams`, and streaming formatters convert the response stream back to the caller's expected format.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output |
| `npm test` | Run tests |

---

## Limitations

- **No image generation** — Claude doesn't generate images. These endpoints return 501.
- **No real distributed computing** — Single process simulating multiple nodes.
- **No persistent state** — Cluster state resets on restart.
- **No authentication** — Exo uses network isolation; ExoSim has no auth layer.
- **Model names are cosmetic** — Every request goes to the configured Claude model regardless of the model name in the request.

---

## License

MIT
