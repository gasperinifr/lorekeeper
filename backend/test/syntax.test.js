import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import test from 'node:test'

function jsFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? jsFiles(path) : path.endsWith('.js') ? [path] : []
  })
}

test('backend source files pass Node syntax checks', () => {
  for (const file of jsFiles(fileURLToPath(new URL('../src', import.meta.url)))) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  }
})
