import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'

// Atomic JSON writes: serialize to a temp file, then rename into place so a
// crash mid-write can never leave a half-written sidecar.

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

export function writeJsonAtomic(file: string, data: unknown): void {
  ensureDir(dirname(file))
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  renameSync(tmp, file)
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}
