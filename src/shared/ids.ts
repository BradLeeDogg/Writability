// Small dependency-free id generator usable in both processes.
export function uid(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return `${prefix}-${time}-${rand}`
}
