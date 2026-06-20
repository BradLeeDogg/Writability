import type { WritabilityApi } from '@shared/api'

declare global {
  interface Window {
    api: WritabilityApi
  }
}
