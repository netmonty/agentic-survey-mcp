#!/usr/bin/env node
import readline from 'node:readline';
import { readInitialMigrationSql } from '@agentic-survey/schema';
import { createDb, listSurveys, isErr } from '@agentic-survey/core';
import { runServer } from './index.js';
import {
  saveConfig,
  loadConfig,
  configPath,
  projectRefFromUrl,
  DEFAULT_PAGE_ENDPOINT,
  type StoredConfig,
} from './config.js';

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

/** Prompt; when hidden, the typed characters are not echoed. */
function ask(query: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    let shownPrompt = false;
    (rl as any)._writeToOutput = (s: string) => {
      if (!shownPrompt) {
        (rl as any).output.write(s);
        shownPrompt = true;
      }
      // mute keystroke echoes
    };
  }
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      if (hidden) (rl as any).output.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

function printAgentSnippet() {
  const snippet = {
    mcpServers: {
      'agentic-survey': {
        command: 'npx',
        args: ['-y', '@agentic-survey/mcp-server'],
      },
    },
  };
  console.log('\nAdd this to your agent config (e.g. Claude Desktop):\n');
  console.log(JSON.stringify(snippet, null, 2));
}

async function runInit(flags: Record<string, string | boolean>) {
  if (flags['print-sql']) {
    process.stdout.write(readInitialMigrationSql());
    return;
  }

  console.log('agentic-survey init — your keys are stored locally and never transmitted.\n');
  const existing = loadConfig();

  const supabaseUrl =
    (flags.url as string) ||
    (await ask(`Supabase project URL${existing.supabaseUrl ? ` [${existing.supabaseUrl}]` : ''}: `)) ||
    existing.supabaseUrl ||
    '';
  const secretKey =
    (flags['secret-key'] as string) ||
    (await ask('Supabase SECRET key (sb_secret_…, hidden): ', true)) ||
    existing.secretKey ||
    '';
  const publishableKey =
    (flags['publishable-key'] as string) ||
    (await ask(
      `Supabase publishable key (sb_publishable_…, optional${existing.publishableKey ? ', set' : ''}): `,
    )) ||
    existing.publishableKey ||
    '';
  const pageEndpoint =
    (flags['page-endpoint'] as string) ||
    (await ask(`Page-service endpoint [${existing.pageEndpoint ?? DEFAULT_PAGE_ENDPOINT}]: `)) ||
    existing.pageEndpoint ||
    DEFAULT_PAGE_ENDPOINT;

  if (!supabaseUrl || !secretKey) {
    console.error('\nA project URL and secret key are required. Aborting.');
    process.exitCode = 1;
    return;
  }

  const cfg: StoredConfig = {
    supabaseUrl,
    secretKey,
    publishableKey: publishableKey || undefined,
    pageEndpoint,
  };
  const path = saveConfig(cfg);
  console.log(`\nSaved config to ${path} (mode 0600).`);
  const ref = projectRefFromUrl(supabaseUrl);
  console.log(`Project ref: ${ref ?? '(could not parse from URL)'}`);

  // Verify the schema is present.
  const db = createDb(supabaseUrl, secretKey);
  const probe = await listSurveys(db, {});
  if (isErr(probe)) {
    console.log('\n⚠  Could not read the survey schema — it may not be installed yet.');
    console.log('   Install it one of these ways:');
    console.log('     1) Run `npx agentic-survey init --print-sql` and paste the output into');
    console.log('        the Supabase SQL editor.');
    console.log('     2) `supabase db push`, or apply via the Supabase MCP.');
  } else {
    console.log(`\n✓ Connected. Schema present (${probe.data.length} survey(s)).`);
  }

  printAgentSnippet();
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  switch (cmd) {
    // Default (no command) = serve: this is what the agent launches via the MCP config.
    case undefined:
    case 'serve':
      await runServer();
      break;
    case 'init':
      await runInit(flags);
      break;
    default:
      console.error(
        `Unknown command: ${cmd}\nUsage:\n  agentic-survey            start the MCP server (stdio)\n  agentic-survey init [--print-sql]   set up / print schema SQL`,
      );
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`fatal: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
