import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mainPath = path.resolve(__dirname, '../src/main.ts');

/**
 * These tests spawn the CLI as a real subprocess with controlled
 * environment variables. That's deliberate: main.ts calls process.exit()
 * directly during validation, and we need to prove it exits with a clear
 * message BEFORE ever constructing a CodeReviewOrchestrator or touching
 * the network -- a mock inside this same process wouldn't demonstrate that
 * ordering as convincingly as an actual isolated process run.
 */
function runCli(args: string[], env: NodeJS.ProcessEnv): { exitCode: number | null; stderr: string } {
  try {
    execFileSync('npx', ['tsx', mainPath, ...args], {
      env,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    });
    return { exitCode: 0, stderr: '' };
  } catch (error) {
    const err = error as { status?: number; stderr?: Buffer | string };
    return {
      exitCode: err.status ?? null,
      stderr: err.stderr?.toString() ?? '',
    };
  }
}

describe('CLI environment validation', () => {
  it('exits with a clear configuration error when GITHUB_TOKEN is missing', () => {
    const env = { ...process.env };
    delete env.GITHUB_TOKEN;
    env.ANTHROPIC_API_KEY = 'test-key-not-used';
    env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';

    const { exitCode, stderr } = runCli(['octocat', 'Hello-World', '1'], env);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Missing required environment configuration');
    expect(stderr).toContain('GITHUB_TOKEN');
  });

  it('exits with a clear configuration error when ANTHROPIC_MODEL is missing', () => {
    const env = { ...process.env };
    delete env.ANTHROPIC_MODEL;
    env.ANTHROPIC_API_KEY = 'test-key-not-used';
    env.GITHUB_TOKEN = 'ghp_test-token-not-used';

    const { exitCode, stderr } = runCli(['octocat', 'Hello-World', '1'], env);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Missing required environment configuration');
    expect(stderr).toContain('ANTHROPIC_MODEL');
  });

  it('exits with a usage message when required CLI arguments are missing', () => {
    const env = { ...process.env };
    env.ANTHROPIC_API_KEY = 'test-key-not-used';
    env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
    env.GITHUB_TOKEN = 'ghp_test-token-not-used';

    const { exitCode, stderr } = runCli(['octocat'], env);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Usage:');
  });

  it('exits with an error when pr-number is not a positive integer', () => {
    const env = { ...process.env };
    env.ANTHROPIC_API_KEY = 'test-key-not-used';
    env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
    env.GITHUB_TOKEN = 'ghp_test-token-not-used';

    const { exitCode, stderr } = runCli(['octocat', 'Hello-World', 'not-a-number'], env);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('positive integer');
  });
});
