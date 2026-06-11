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
      `Supabase publishable key (sb_publishable_…, needed for share links${existing.publishableKey ? ', already set' : ''}): `,
    )) ||
    existing.publishableKey ||
    '';

  // Page-service: the domain published survey links point at. Default to the
  // hosted instance; let people opt into their own self-hosted/custom domain.
  let pageEndpoint = (flags['page-endpoint'] as string) || '';
  if (!pageEndpoint) {
    const current = existing.pageEndpoint ?? DEFAULT_PAGE_ENDPOINT;
    console.log('\nWhich domain do you want your surveys to appear on?');
    console.log(`  1. ${DEFAULT_PAGE_ENDPOINT}/s/your-survey   (default, quick start)`);
    console.log('  2. A custom domain (your own self-hosted page-service)');
    const choice = (await ask(`Choose 1 or 2 [keep ${current}]: `)).trim();
    if (choice === '1') {
      pageEndpoint = DEFAULT_PAGE_ENDPOINT;
    } else if (choice === '2') {
      pageEndpoint =
        (await ask('Your page-service base URL (e.g. https://surveys.example.com): ')).trim() ||
        current;
    } else {
      pageEndpoint = current; // Enter keeps the shown default
    }
  }

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

  if (!publishableKey) {
    console.log(
      "\n⚠  No publishable key set. Share links and response collection won't work until you add one (re-run init).",
    );
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
