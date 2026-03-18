import type { ParserPlugin } from '../plugins/PluginInterface.js';
import { buildParseResult } from '../plugins/PluginInterface.js';
import type { ScannedFile } from '../scanner/FileScanner.js';
import type { ParseResult, ParseContext } from '../types/index.js';

export interface PipelineOptions {
  /** Plugins in priority order — first match wins */
  plugins: ParserPlugin[];
  /** Called after each file is processed (for progress tracking) */
  onProgress?: (processed: number, total: number, filePath: string) => void;
}

/**
 * Repository Processing Pipeline
 *
 * Flow: ScannedFiles → Language Detection → Plugin Routing → AST Parsing → ParseResults
 */
export class Pipeline {
  constructor(private readonly options: PipelineOptions) {}

  async process(files: ScannedFile[], allPaths: Set<string>): Promise<ParseResult[]> {
    const results: ParseResult[] = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      const plugin = this.detectPlugin(file.absolutePath);

      if (!plugin) continue;

      const context: ParseContext = {
        filePath: file.absolutePath,
        rootDir: '',  // set by caller if needed
        allFiles: allPaths,
      };

      const result = buildParseResult(plugin, file.content, context);
      results.push(result);

      this.options.onProgress?.(i + 1, total, file.relativePath);
    }

    return results;
  }

  detectPlugin(filePath: string): ParserPlugin | null {
    for (const plugin of this.options.plugins) {
      if (plugin.canHandle(filePath)) return plugin;
    }
    return null;
  }

  /** Returns statistics about which languages were detected */
  summarize(results: ParseResult[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.language] = (counts[r.language] ?? 0) + 1;
    }
    return counts;
  }
}
