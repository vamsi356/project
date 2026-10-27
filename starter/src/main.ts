import * as dotenv from 'dotenv';
if (!process.env.VITEST) {
  dotenv.config();
}

import { promises as fs } from 'fs';
import path from 'path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { logger } from './utils/logger.js';
import { ReviewError, formatError } from './utils/error-handler.js';

async function main() {
  const missing: string[] = [];
  if (!process.env.GITHUB_TOKEN) {
    missing.push('GITHUB_TOKEN');
  }
  if (!process.env.ANTHROPIC_MODEL) {
    missing.push('ANTHROPIC_MODEL');
  }

  const hasAnthropicAPI = !!process.env.ANTHROPIC_API_KEY;
  const hasAWSCredentials = !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  );

  if (missing.length > 0 || (!hasAnthropicAPI && !hasAWSCredentials)) {
    console.error('Missing required environment configuration:');
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
    console.error('Provide either ANTHROPIC_API_KEY or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION.');
    process.exit(1);
  }

  const [owner, repo, prStr] = process.argv.slice(2);

  if (!owner || !repo || !prStr) {
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    console.error('Example: npm run dev -- facebook react 12345');
    process.exit(1);
  }

  const prNumber = parseInt(prStr, 10);
  if (isNaN(prNumber) || prNumber <= 0 || String(prNumber) !== prStr) {
    console.error('Error: pr-number must be a positive integer.');
    process.exit(1);
  }

  if (hasAWSCredentials && !hasAnthropicAPI) {
    console.log('🔐 Using AWS Bedrock authentication');
  } else {
    console.log('🔐 Using Anthropic API authentication');
  }

  logger.info(`Starting review of ${owner}/${repo} PR #${prNumber}...`);

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const reportGenerator = new ReportGenerator();
    const outDir = 'reports';
    await fs.mkdir(outDir, { recursive: true });

    const base = `${owner}_${repo}_${prNumber}`;
    const jsonPath = path.join(outDir, `${base}.json`);
    const mdPath = path.join(outDir, `${base}.md`);
    const htmlPath = path.join(outDir, `${base}.html`);

    await Promise.all([
      fs.writeFile(jsonPath, reportGenerator.generateJSONReport(report), 'utf-8'),
      fs.writeFile(mdPath, reportGenerator.generateMarkdownReport(report), 'utf-8'),
      fs.writeFile(htmlPath, reportGenerator.generateHTMLReport(report), 'utf-8'),
    ]);

    logger.info('Review complete. Reports saved:');
    logger.info(`  JSON:     ${jsonPath}`);
    logger.info(`  Markdown: ${mdPath}`);
    logger.info(`  HTML:     ${htmlPath}`);
    logger.info(`  Overall score: ${report.summary.overallScore}/100`);
  } catch (error) {
    if (error instanceof ReviewError) {
      console.error(`Review failed [${error.code}]: ${error.message}`);
    } else {
      console.error('Error:', formatError(error));
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});