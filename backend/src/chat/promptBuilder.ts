import type { ChatContext } from '../types/index.js';

/**
 * Builds a structured system prompt from graph context.
 * Keeps the prompt concise to minimize token usage while providing
 * enough context for the LLM to answer codebase questions accurately.
 */
export function buildSystemPrompt(context: ChatContext): string {
  const parts: string[] = [];

  parts.push(
    `You are a codebase analysis assistant for the Codebase Intelligence Platform.`,
    `You answer questions ONLY based on the dependency graph context provided below.`,
    `If you don't have enough information to answer, say so clearly. Do NOT guess or hallucinate.`,
    `Focus on dependency relationships, impact analysis, and code structure.`,
    `Keep answers concise, technical, and actionable.`,
    `Use bullet points and short paragraphs. Avoid unnecessary filler.`,
  );

  // Graph summary
  parts.push(
    `\n## Repository Summary`,
    `- Path: ${context.graphSummary.repoPath}`,
    `- Files: ${context.graphSummary.totalFiles}`,
    `- Nodes: ${context.graphSummary.totalNodes} | Edges: ${context.graphSummary.totalEdges}`,
    `- Languages: ${Object.entries(context.graphSummary.languages)
      .filter(([, c]) => c > 0)
      .map(([l, c]) => `${l}(${c})`)
      .join(', ')}`,
  );

  // Selected node
  if (context.selectedNode) {
    const sn = context.selectedNode;
    parts.push(
      `\n## Currently Selected Node`,
      `- ID: ${sn.id}`,
      `- Name: ${sn.name}`,
      `- Type: ${sn.type} | Language: ${sn.language}`,
      `- File: ${sn.filePath}`,
    );
  }

  // Dependencies
  if (context.directDependencies?.length) {
    parts.push(
      `\n## Direct Dependencies (this node imports ${context.directDependencies.length} modules)`,
      ...context.directDependencies.map(d => `- ${d.name} [${d.language}]`),
    );
  }

  // Dependents
  if (context.directDependents?.length) {
    parts.push(
      `\n## Direct Dependents (${context.directDependents.length} modules import this node)`,
      ...context.directDependents.map(d => `- ${d.name} [${d.language}]`),
    );
  }

  // Impact stats
  if (context.impactStats) {
    parts.push(
      `\n## Impact Analysis`,
      `- Total nodes impacted by changes to selected node: ${context.impactStats.totalImpacted}`,
      `- Total dependencies of selected node: ${context.impactStats.totalDependencies}`,
      `- Max impact depth (longest dependency chain): ${context.impactStats.maxImpactDepth}`,
    );
  }

  // Critical nodes
  if (context.criticalNodes?.length) {
    parts.push(
      `\n## Most Critical Nodes in Repository (by dependent count)`,
      ...context.criticalNodes.map(c => `- ${c.name}: ${c.dependentCount} dependents`),
    );
  }

  return parts.join('\n');
}
