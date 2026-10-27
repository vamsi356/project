/**
 * Model Context Protocol (MCP) server definitions and parameters
 *
 * Mandatory MCP Servers:
 * 1. GitHub - Repository and Pull Request interactions
 * 2. ESLint - Linting checks and code formatting reviews
 *
 * References:
 * - MCP Standard: https://modelcontextprotocol.io
 * - GitHub MCP: https://github.com/github/github-mcp-server
 * - ESLint MCP: https://eslint.org/docs/latest/use/mcp
 */

export const mcpServersConfig = {
  /**
   * GitHub MCP Server Integration
   * Supplies tools for interacting with GitHub APIs
   *
   * Configuration specs:
   * - type: 'stdio' as const
   * - command: 'npx'
   * - args: ['-y', '@modelcontextprotocol/server-github']
   * - env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '' }
   *
   * Note: GITHUB_TOKEN is optional (recommended for private repos and higher rate limits).
   * The GitHub MCP server expects GITHUB_PERSONAL_ACCESS_TOKEN as the env var name.
   * We map our GITHUB_TOKEN from .env to this expected name.
   */
  github: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '' }
  },

  /**
   * ESLint MCP Server Integration
   * Supplies tools for code analysis and style checks
   *
   * Configuration specs:
   * - type: 'stdio' as const
   * - command: 'npx'
   * - args: ['-y', '@eslint/mcp@latest']
   * - env: {}
   */
  eslint: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@eslint/mcp@latest'],
    env: {}
  }
};

