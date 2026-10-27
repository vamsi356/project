import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

/**
 * Detects refactoring possibilities in an individual modified file --
 * such as design pattern opportunities, syntax modernization, function extraction targets,
 * and unused code -- outputting a single RefactoringSuggestion JSON structure
 * for that specific file.
 */
export const refactoringSuggester: AgentDefinition = {
  description:
    'Detects potential code improvements in a single modified file -- ' +
    'design pattern potentials, modernization updates, function extraction targets, ' +
    'and dead code -- outputting a ' +
    'RefactoringSuggestion JSON object for that file. Trigger this agent ' +
    'whenever a file requires a structural or cleanliness review.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
};