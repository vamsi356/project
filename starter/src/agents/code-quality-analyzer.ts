import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Reviews a single modified source file for security flaws,
 * execution bottlenecks, and code health issues, providing a unified
 * CodeQualityResult JSON structure for that specific file.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Evaluates an individual modified code file to detect security risks, ' +
    'performance bottlenecks, and maintainability concerns, outputting a ' +
    'CodeQualityResult JSON object. Invoke this agent whenever ' +
    'a file requires a security, performance, or code health audit.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill', 'mcp__eslint__lint-files'],
};