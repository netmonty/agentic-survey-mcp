import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './server.js';

export { buildServer } from './server.js';

/** Start the MCP server over stdio. */
export async function runServer(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio transport keeps the process alive; log to stderr (stdout is the protocol).
  process.stderr.write('agentic-survey MCP server running on stdio\n');
}
