# Codebase Intelligence

A static analysis platform that scans a codebase, builds a dependency graph, and lets you explore it visually or query it with an AI assistant.

## Features

- **Multi-language support** — TypeScript, JavaScript, Python, Java, Go
- **Three ingestion modes** — local path, Git URL (shallow clone), or browser file upload
- **Dependency graph** — file-level and symbol-level nodes with import edges
- **Impact analysis** — find everything affected by a change to a given node
- **AI chat** — ask questions about the codebase using Claude as the backend
- **Interactive visualization** — React Flow graph with language-colored nodes, zoom, pan, and node inspection

## Architecture

```
backend/   — Node.js/TypeScript analysis engine (Express, port 3001)
frontend/  — React/TypeScript visualization UI (Vite, port 5173)
```

### Backend pipeline

```
FileScanner  →  Plugin (parse + extract)  →  GraphBuilder  →  ImpactAnalyzer
```

Each language is handled by a plugin that implements a common `ParserPlugin` interface:

| Plugin | Extensions | Strategy |
|--------|-----------|----------|
| TypeScriptPlugin | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` | ESTree AST via `@typescript-eslint/typescript-estree` |
| PythonPlugin | `.py` | Regex static analysis |
| JavaPlugin | `.java` | Regex static analysis |
| GoPlugin | `.go` | Regex static analysis + stdlib filtering |

## Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/) (for the chat feature)

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm run dev            # starts on http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:5173
```

## Usage

1. Open `http://localhost:5173` in your browser.
2. Choose an ingestion method:
   - **Local path** — enter an absolute path to a directory on the server machine
   - **Git URL** — paste a `https://` or `git@` URL; the backend does a shallow clone
   - **Upload** — drag and drop or select a folder from your browser
3. Click **Analyze**. The graph appears once analysis completes.
4. Click any node to inspect its imports, exports, and dependents.
5. Use the **Chat** panel to ask questions like "What calls AuthService?" or "Which files are most critical?"

## API

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/analyze` | Analyze a local path or Git URL |
| `POST` | `/upload-analyze` | Analyze files uploaded via multipart form |
| `GET` | `/graph` | Return the current graph |
| `GET` | `/graph/stats` | Return metadata and top critical nodes |
| `GET` | `/impact/:nodeId` | Return impact analysis for a node |
| `POST` | `/chat` | Send a message to the AI assistant |
| `GET` | `/health` | Health check |

### POST /analyze

```json
{
  "repoPath": "/absolute/path/to/repo",
  "gitUrl": "https://github.com/owner/repo",
  "maxFileSize": 102400
}
```

Provide either `repoPath` or `gitUrl`, not both.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes (for chat) | Anthropic API key |

## Adding a New Language

1. Add the language to the `Language` type in `backend/src/types/index.ts` and `frontend/src/types/index.ts`.
2. Add the file extension to `DEFAULT_EXTENSIONS` in `backend/src/scanner/FileScanner.ts`.
3. Create `backend/src/plugins/<lang>/<Lang>Plugin.ts` implementing the `ParserPlugin` interface.
4. Register the plugin in the `plugins` array in `backend/src/api/routes.ts`.
5. Add import resolution logic in `backend/src/graph/GraphBuilder.ts`.
6. Add a color/label/icon entry to `LANGUAGE_CONFIG` in `frontend/src/types/index.ts`.
