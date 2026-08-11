/**
 * Ensure the published CLI is executable under Bun via shebang.
 */
import { readFile, writeFile, chmod } from 'node:fs/promises'
import path from 'node:path'

const cliPath = path.resolve(import.meta.dir, '../dist/cli.js')
let source = await readFile(cliPath, 'utf8')
if (!source.startsWith('#!')) {
  source = `#!/usr/bin/env bun\n${source}`
  await writeFile(cliPath, source)
}
await chmod(cliPath, 0o755)
console.log('[hydra-gfx-sdk] shebang + chmod applied to dist/cli.js')
