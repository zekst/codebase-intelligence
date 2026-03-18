import fs from 'fs';
import path from 'path';
import os from 'os';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { simpleGit } from 'simple-git';
import { rimraf } from 'rimraf';
import { FileScanner } from '../scanner/FileScanner.js';
import { Pipeline } from '../pipeline/Pipeline.js';
import { GraphBuilder } from '../graph/GraphBuilder.js';
import { ImpactAnalyzer } from '../analysis/ImpactAnalyzer.js';
import { TypeScriptPlugin } from '../plugins/typescript/TypeScriptPlugin.js';
import { PythonPlugin } from '../plugins/python/PythonPlugin.js';
import { JavaPlugin } from '../plugins/java/JavaPlugin.js';
import { GoPlugin } from '../plugins/go/GoPlugin.js';
import { handleChat } from '../chat/chatHandler.js';
import type { Graph, AnalyzeRequest, ChatRequest } from '../types/index.js';

const router = Router();

// ── Multer config for file uploads ──────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10000 },
});

// ── State ───────────────────────────────────────────────────────────────────
let currentGraph: Graph | null = null;
let currentAnalyzer: ImpactAnalyzer | null = null;
let analysisInProgress = false;
const tempDirs: string[] = []; // track temp directories for cleanup

// Plugin registry
const plugins = [
  new TypeScriptPlugin(),
  new PythonPlugin(),
  new JavaPlugin(),
  new GoPlugin(),
];

// ── Shared analysis logic ───────────────────────────────────────────────────

async function analyzeDirectory(repoPath: string, maxFileSize?: number, label?: string): Promise<{ graph: Graph; duration: number }> {
  const startTime = Date.now();

  console.log(`\n🔍 Analyzing: ${label || repoPath}`);

  const scanner = new FileScanner();
  const files = await scanner.scan({ rootDir: repoPath, maxFileSize });
  console.log(`   📁 Found ${files.length} files`);

  const allPaths = scanner.buildPathSet(files);

  const pipeline = new Pipeline({
    plugins,
    onProgress: (done, total, file) => {
      if (done % 50 === 0 || done === total) {
        console.log(`   ⚙️  Parsed ${done}/${total}: ${file}`);
      }
    },
  });
  const parseResults = await pipeline.process(files, allPaths);

  const langSummary = pipeline.summarize(parseResults);
  console.log(`   🌐 Languages:`, langSummary);

  const builder = new GraphBuilder();
  const graph = builder.build(parseResults, repoPath, allPaths);
  console.log(`   📊 Graph: ${graph.metadata.totalNodes} nodes, ${graph.metadata.totalEdges} edges`);

  const duration = Date.now() - startTime;
  console.log(`   ✅ Analysis complete in ${duration}ms\n`);

  return { graph, duration };
}

function setGraph(graph: Graph) {
  currentGraph = graph;
  currentAnalyzer = new ImpactAnalyzer(graph);
}

function makeTempDir(prefix: string): string {
  const dir = path.join(os.tmpdir(), `cip-${prefix}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

async function cleanupTemp(dir: string) {
  try {
    await rimraf(dir);
    const idx = tempDirs.indexOf(dir);
    if (idx !== -1) tempDirs.splice(idx, 1);
  } catch (e) {
    console.warn(`Cleanup failed for ${dir}:`, (e as Error).message);
  }
}

// ── POST /analyze — local path or git URL ───────────────────────────────────

router.post('/analyze', async (req: Request, res: Response) => {
  const body = req.body as AnalyzeRequest;

  if (!body.repoPath && !body.gitUrl) {
    res.status(400).json({ success: false, error: 'Provide repoPath or gitUrl' });
    return;
  }

  if (analysisInProgress) {
    res.status(429).json({ success: false, error: 'Analysis already in progress' });
    return;
  }

  analysisInProgress = true;
  let tempDir: string | null = null;

  try {
    let targetPath: string;
    let label: string;

    if (body.gitUrl) {
      // ── Git clone flow ──────────────────────────────────────────────────
      const url = body.gitUrl.trim();
      if (!/^https?:\/\/.+/i.test(url) && !url.startsWith('git@')) {
        res.status(400).json({ success: false, error: 'Invalid git URL. Use https:// or git@ format.' });
        return;
      }

      tempDir = makeTempDir('git');
      console.log(`\n📥 Cloning ${url} → ${tempDir}`);

      const git = simpleGit();
      await git.clone(url, tempDir, ['--depth', '1', '--single-branch']);
      console.log(`   ✅ Clone complete`);

      targetPath = tempDir;
      label = url;
    } else {
      // ── Local path flow ─────────────────────────────────────────────────
      targetPath = body.repoPath!;
      label = targetPath;
    }

    const { graph, duration } = await analyzeDirectory(targetPath, body.maxFileSize, label);

    // Override metadata to show git URL if cloned
    if (body.gitUrl) {
      graph.metadata.repoPath = body.gitUrl;
    }

    setGraph(graph);

    res.json({ success: true, graph, duration });
  } catch (err) {
    console.error('Analysis failed:', err);
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  } finally {
    analysisInProgress = false;
    // Cleanup temp dir in background
    if (tempDir) cleanupTemp(tempDir);
  }
});

// ── POST /upload-analyze — browser file upload ──────────────────────────────

router.post('/upload-analyze', (req: Request, res: Response, next) => {
  upload.array('files', 10000)(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      res.status(400).json({ success: false, error: `Upload error: ${(err as Error).message}` });
      return;
    }
    next();
  });
}, async (req: Request, res: Response) => {
  if (analysisInProgress) {
    res.status(429).json({ success: false, error: 'Analysis already in progress' });
    return;
  }

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ success: false, error: 'No files uploaded' });
    return;
  }

  analysisInProgress = true;
  const tempDir = makeTempDir('upload');

  try {
    console.log(`\n📤 Received ${files.length} uploaded files`);

    // Write uploaded files to temp directory preserving relative paths
    for (const file of files) {
      // Browser sends webkitRelativePath as the filename via FormData
      const relativePath = file.originalname.replace(/\\/g, '/');
      // Security: strip leading slashes and ../ to prevent path traversal
      const safePath = relativePath.replace(/^[./\\]+/, '').replace(/\.\.\//g, '');
      const filePath = path.join(tempDir, safePath);
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, file.buffer);
    }

    const { graph, duration } = await analyzeDirectory(tempDir, undefined, `upload (${files.length} files)`);

    // Set a friendly repo path in metadata
    graph.metadata.repoPath = `Uploaded folder (${files.length} files)`;

    setGraph(graph);

    res.json({ success: true, graph, duration });
  } catch (err) {
    console.error('Upload analysis failed:', err);
    res.status(500).json({
      success: false,
      error: (err as Error).message,
    });
  } finally {
    analysisInProgress = false;
    cleanupTemp(tempDir);
  }
});

// ── GET /graph ──────────────────────────────────────────────────────────────

router.get('/graph', (_req: Request, res: Response) => {
  if (!currentGraph) {
    res.status(404).json({ error: 'No graph available. Run POST /analyze first.' });
    return;
  }
  res.json(currentGraph);
});

// ── GET /graph/stats ────────────────────────────────────────────────────────

router.get('/graph/stats', (_req: Request, res: Response) => {
  if (!currentGraph || !currentAnalyzer) {
    res.status(404).json({ error: 'No graph available.' });
    return;
  }

  const criticalNodes = currentAnalyzer.getCriticalNodes(10);
  res.json({
    metadata: currentGraph.metadata,
    criticalNodes: criticalNodes.map(c => ({
      id: c.node.id,
      name: c.node.name,
      language: c.node.language,
      dependentCount: c.dependentCount,
    })),
  });
});

// ── GET /impact/:nodeId ─────────────────────────────────────────────────────

router.get('/impact/:nodeId(*)', (req: Request, res: Response) => {
  if (!currentAnalyzer || !currentGraph) {
    res.status(404).json({ error: 'No graph available.' });
    return;
  }

  const nodeId = req.params.nodeId;
  const result = currentAnalyzer.analyze(nodeId);
  res.json(result);
});

// ── GET /health ─────────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGraph: currentGraph !== null,
    nodeCount: currentGraph?.metadata.totalNodes ?? 0,
    edgeCount: currentGraph?.metadata.totalEdges ?? 0,
  });
});

// ── POST /chat — context-aware codebase assistant ────────────────────────────

router.post('/chat', async (req: Request, res: Response) => {
  if (!currentGraph) {
    res.status(400).json({ success: false, error: 'No graph loaded. Analyze a repository first.' });
    return;
  }

  const body = req.body as ChatRequest;

  if (!body.message?.trim()) {
    res.status(400).json({ success: false, error: 'Message is required.' });
    return;
  }

  // Enrich context with critical nodes from server-side ImpactAnalyzer
  if (!body.context.criticalNodes && currentAnalyzer) {
    body.context.criticalNodes = currentAnalyzer.getCriticalNodes(5).map(c => ({
      name: c.node.name,
      dependentCount: c.dependentCount,
    }));
  }

  const result = await handleChat(body);

  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

export default router;
