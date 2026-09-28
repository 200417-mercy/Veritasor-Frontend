import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}))

vi.mock('react-dom/client', () => ({ createRoot: mocks.createRoot }))
vi.mock('./App', () => ({ default: () => null }))

describe('main entry point', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.resetModules()
    mocks.createRoot.mockClear()
  })

  it('creates the app root and renders App inside StrictMode and BrowserRouter', async () => {
    document.body.innerHTML = '<div id="root"></div>'

    await import('./main')
    const [{ StrictMode }, { BrowserRouter }, { default: App }] = await Promise.all([
      import('react'),
      import('react-router-dom'),
      import('./App'),
    ])

    expect(mocks.createRoot).toHaveBeenCalledOnce()
    expect(mocks.createRoot).toHaveBeenCalledWith(document.getElementById('root'))

    const render = mocks.createRoot.mock.results[0]?.value.render
    expect(render).toHaveBeenCalledOnce()

    const strictModeElement = render.mock.calls[0]?.[0]
    expect(strictModeElement.type).toBe(StrictMode)

    const routerElement = strictModeElement.props.children
    expect(routerElement.type).toBe(BrowserRouter)
    expect(routerElement.props.children.type).toBe(App)
  })

  it('throws a deterministic error when the root element is missing', async () => {
    await expect(import('./main')).rejects.toThrow('Root element "#root" was not found.')
    expect(mocks.createRoot).not.toHaveBeenCalled()
  })

  it('bootstraps successfully when the root is added after a missing-root failure', async () => {
    await expect(import('./main')).rejects.toThrow('Root element "#root" was not found.')

    document.body.innerHTML = '<div id="root"></div>'
    vi.resetModules()
    await import('./main')

    expect(mocks.createRoot).toHaveBeenCalledOnce()
    expect(mocks.createRoot).toHaveBeenCalledWith(document.getElementById('root'))
    expect(mocks.createRoot.mock.results[0]?.value.render).toHaveBeenCalledOnce()
  })
})
