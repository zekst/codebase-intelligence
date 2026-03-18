import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface ScanOptions {
  /** Root directory to scan */
  rootDir: string;
  /** Max file size in bytes before skipping (default 512 KB) */
  maxFileSize?: number;
  /** Languages to include; empty = all supported */
  extensions?: string[];
}

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  content: string;
}

const DEFAULT_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'java', 'go'];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/__pycache__/**',
  '**/.pytest_cache/**',
  '**/target/**',       // Java/Maven
  '**/vendor/**',       // Go
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.bundle.js',
];

export class FileScanner {
  async scan(options: ScanOptions): Promise<ScannedFile[]> {
    const {
      rootDir,
      maxFileSize = 512 * 1024,
      extensions = DEFAULT_EXTENSIONS,
    } = options;

    if (!fs.existsSync(rootDir)) {
      throw new Error(`Repository path does not exist: ${rootDir}`);
    }

    const stat = fs.statSync(rootDir);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${rootDir}`);
    }

    const pattern = `**/*.{${extensions.join(',')}}`;
    const filePaths = await glob(pattern, {
      cwd: rootDir,
      absolute: true,
      ignore: IGNORE_PATTERNS,
      nodir: true,
    });

    const results: ScannedFile[] = [];

    for (const absPath of filePaths) {
      try {
        const fileStat = fs.statSync(absPath);
        if (fileStat.size > maxFileSize) continue;

        const content = fs.readFileSync(absPath, 'utf-8');
        const ext = path.extname(absPath).slice(1).toLowerCase();
        const relativePath = path.relative(rootDir, absPath);

        results.push({
          absolutePath: absPath,
          relativePath,
          extension: ext,
          sizeBytes: fileStat.size,
          content,
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return results;
  }

  /** Build a Set of all absolute paths for quick lookup during import resolution */
  buildPathSet(files: ScannedFile[]): Set<string> {
    return new Set(files.map(f => f.absolutePath));
  }
}
