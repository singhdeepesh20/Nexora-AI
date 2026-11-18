/** Local API client. All calls go to the NEXORA backend on this machine only. */

function token(): string {
  // Production: the backend injects the per-launch token into index.html (same origin only).
  // Development: the Vite proxy attaches it, so this is empty.
  return document.querySelector<HTMLMetaElement>('meta[name="nexora-token"]')?.content ?? ''
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown, raw?: BodyInit): Promise<T> {
  const headers: Record<string, string> = { 'x-nexora-token': token() }
  let payload: BodyInit | undefined = raw
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`/api/v1${path}`, { method, headers, body: payload })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = await res.json()
      detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch { /* non-JSON error */ }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get('content-type') ?? ''
  return (type.includes('application/json') ? res.json() : res.blob()) as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, file: Blob) => request<T>('POST', path, undefined, file),
  download: (path: string) => request<Blob>('GET', path),
}
