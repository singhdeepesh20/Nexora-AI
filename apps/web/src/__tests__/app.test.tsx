import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Welcome } from '../app/Welcome'
import { AssessmentPanel } from '../components/laboratories/LessonPanel'
import { Markdown } from '../components/ui/Markdown'
import { api, ApiError } from '../services/api'
import { useApp } from '../stores/app'

type Route = (method: string, url: string, body: unknown) => unknown
let route: Route
const calls: { method: string; url: string; body: unknown }[] = []

beforeEach(() => {
  calls.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const method = init?.method ?? 'GET'
    calls.push({ method, url, body })
    const out = route(method, url, body)
    if (out instanceof ApiError) return new Response(JSON.stringify({ detail: out.message }), { status: out.status, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify(out ?? {}), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
  useApp.setState({ overlays: [], toasts: [], students: [], student: null, learning: null, concepts: {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  it('sends the local access token and surfaces API errors', async () => {
    document.head.innerHTML = '<meta name="nexora-token" content="tok123">'
    route = () => new ApiError(403, 'Master the prerequisites first')
    await expect(api.get('/x')).rejects.toThrow('Master the prerequisites first')
    const init = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]
    expect((init.headers as Record<string, string>)['x-nexora-token']).toBe('tok123')
  })
})

describe('overlay navigation store', () => {
  it('pushes, goes back and closes', () => {
    const s = useApp.getState()
    s.open({ kind: 'map' })
    s.open({ kind: 'district', id: 'foundation' })
    expect(useApp.getState().overlays.map((o) => o.kind)).toEqual(['map', 'district'])
    useApp.getState().back()
    expect(useApp.getState().overlays.map((o) => o.kind)).toEqual(['map'])
    useApp.getState().closeAll()
    expect(useApp.getState().overlays).toEqual([])
  })
})

describe('Markdown', () => {
  it('renders curriculum markdown and strips scripts', () => {
    const { container } = render(<Markdown source={'# Title\n\n**bold** <img src=x onerror="alert(1)"><script>alert(1)</script>'} />)
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('onerror')
    expect(container.innerHTML).not.toContain('<script')
  })
})

describe('Welcome', () => {
  it('creates a local profile without registration', async () => {
    const student = { id: 's1', display_name: 'Ada', created_at: '2026-01-01T00:00:00', settings: {}, avatar: null }
    route = (m, url) => {
      if (m === 'POST' && url.endsWith('/students')) return student
      if (url.endsWith('/students/s1')) return student
      if (url.endsWith('/learning')) return { concepts: {}, recommendations: [], skills: [], totals: { mastered: 0, concepts: 0 } }
      return {}
    }
    render(<Welcome />)
    await userEvent.type(screen.getByPlaceholderText('e.g. Ada'), 'Ada')
    await userEvent.click(screen.getByRole('button', { name: 'Enter the campus' }))
    await waitFor(() => expect(useApp.getState().student?.id).toBe('s1'))
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ display_name: 'Ada' })
  })
})

describe('AssessmentPanel', () => {
  it('submits answers and shows deterministic per-question feedback', async () => {
    useApp.setState({ student: { id: 's1', display_name: 'A', created_at: '', settings: {}, avatar: null }, overlays: [{ kind: 'assessment', conceptId: 'c1' }] })
    route = (m, url) => {
      if (url.endsWith('/assessment') && m === 'GET') return { concept_id: 'c1', version: '1', pass_score: 0.8, questions: [
        { id: 'q1', type: 'numeric', prompt: 'What is 2+2?' }, { id: 'q2', type: 'choice', prompt: 'Pick B', options: ['A', 'B'] }] }
      if (url.endsWith('/assessment') && m === 'POST') return {
        score: 0.5, passed: false, pass_score: 0.8, unlocked: [], achievements: [],
        concept_state: { status: 'in_progress', required_mission: null, required_mission_passed: null },
        results: [{ id: 'q1', correct: true, given: '4', expected: 4, explanation: 'Arithmetic.' }, { id: 'q2', correct: false, given: 0, expected: 'B', explanation: 'It was B.' }] }
      if (url.endsWith('/learning')) return { concepts: {}, recommendations: [], skills: [], totals: { mastered: 0, concepts: 0 } }
      return {}
    }
    render(<AssessmentPanel conceptId="c1" />)
    fireEvent.change(await screen.findByLabelText('Answer to question 1'), { target: { value: '4' } })
    await userEvent.click(screen.getByLabelText('A'))
    await act(async () => { await userEvent.click(screen.getByRole('button', { name: 'Submit answers' })) })
    expect(await screen.findByText(/Score 50%/)).toBeInTheDocument()
    expect(screen.getByText('It was B.')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ answers: { q1: '4', q2: 0 } })
  })
})

describe('ErrorBoundary', () => {
  it('contains a crashing panel and lets the student close it', async () => {
    const { ErrorBoundary } = await import('../components/ui/ErrorBoundary')
    const onReset = vi.fn()
    const Boom = () => { throw new Error('kaboom') }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<ErrorBoundary onReset={onReset}><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('kaboom')
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(onReset).toHaveBeenCalled()
  })
})
