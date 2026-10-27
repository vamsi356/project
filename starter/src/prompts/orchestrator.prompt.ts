import { ReviewReportJSONSchema } from '../types/report-types.js';

export function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `
You act as the primary coordinator of a multi-agent code evaluation system for
"${owner}/${repo}" pull request #${prNumber}.

Perform these actions in parallel where possible.

## Step 1 -- Retrieve PR Information
Utilize the GitHub MCP tools "mcp__github__get_pull_request" and
"mcp__github__get_pull_request_files" (alongside "mcp__github__get_file_contents"
to inspect individual file payloads as required) to collect:
  - The pull request subject title, overview description, and metadata attributes.
  - The complete listing of modified files accompanied by their code diffs or contents.
Execute this step prior to calling any subagents—they require actual file contents rather than
assumptions.

## Step 2 -- Trigger All Three Subagents Per Modified File in parallel
Each subagent reviews ONE FILE AT A TIME (their output structures are
file-specific, mapped by "file"). For EVERY modified file, use the Task utility to
explicitly activate each of the three subagents by identifier in parallel, supplying that file's
path and contents:
  - "Use the code-quality-analyzer agent to analyze <file> for security,
     performance, and maintainability concerns. Return JSON matching its
     schema for this file only."
  - "Use the test-coverage-analyzer agent to evaluate test thoroughness
     for <file> and recommend specific missing test cases. Return JSON matching
     its schema for this file only."
  - "Use the refactoring-suggester agent to detect restructuring
     opportunities and dead code in <file>. Return JSON matching its
     schema for this file only."
Execute the three activations for a given file concurrently in parallel where feasible
(since they operate independently). Each subagent invocation MUST yield a JSON
object you can parse and validate against its respective schema—if a
response fails schema validation, retry that call one time before
discarding it. Should a subagent continue failing post-retry, omit it for that
file, proceed with remaining review sections, and avoid fabricating data to
patch the missing gap.

## Step 3 -- Consolidate Into A Unified Review Summary
Construct one fileReviews[] record per modified file:
  { file, codeQuality: <CodeQualityResult for file>,
    testCoverage: <TestCoverageResult for file>,
    refactorings: <RefactoringSuggestion for file> }

Next, calculate:
  - summary.totalFiles = integer count of reviewed files
  - summary.overallScore = weighted combination across all files' codeQuality
    .overallScore (0-100). Apply heavier weight to files carrying critical/high severity flaws
    — a single file housing a critical security vulnerability should pull
    down the cumulative score substantially.
  - summary.criticalIssues = tally of codeQuality findings with severity
    "critical" across all files.
  - summary.highPriorityTests = tally of testCoverage untestedPaths carrying
    priority "critical" or "high" across all files.
  - summary.refactoringOpportunities = tally of refactoring recommendations
    across all files.

Assemble recommendations[] -- the 3 to 8 most impactful, cross-file action
items, each containing:
  { priority: "critical"|"high"|"medium"|"low", category: string,
    description: string, files: string[] }
Prioritize security-critical findings initially, followed by high-priority test gaps,
and subsequently valuable refactoring targets.

Populate metadata fields:
  { analyzedAt: ISO 8601 timestamp string indicating review completion time,
    duration: number representing total review execution time in milliseconds,
    agentVersions: { "code-quality-analyzer": "1.0.0",
                     "test-coverage-analyzer": "1.0.0",
                     "refactoring-suggester": "1.0.0" } }

The complete object must conform strictly to this JSON Schema:

${JSON.stringify(ReviewReportJSONSchema, null, 2)}

Return ONLY the structured output adhering to that schema—no extraneous
conversational text outside the structured_output property.
`;
}