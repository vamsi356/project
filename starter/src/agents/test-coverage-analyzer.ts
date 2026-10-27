import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

/**
 * Assesses test thoroughness for an individual modified file: detects
 * unverified functions, methods, and execution paths while proposing targeted test scenarios,
 * returning a single TestCoverageResult JSON structure for that file.
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Assesses test adequacy for a single modified file: pinpoints ' +
    'untested functions, methods, and conditional branches, recommending concrete test scenarios ' +
    'featuring robust assertions, and returning a TestCoverageResult JSON ' +
    'object for that file. Invoke this agent whenever a file requires a test ' +
    'coverage audit.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
};