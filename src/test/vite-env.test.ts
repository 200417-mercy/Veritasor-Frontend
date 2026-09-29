import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import rawSource from '../hooks/useOnlineStatus.ts?raw'
import tsUrl from '../hooks/useOnlineStatus.ts?url'
import svgInline from '../../public/favicon.svg'
import svgUrl from '../../public/favicon.svg?url'

/**
 * Dedicated test fixture for src/vite-env.d.ts.
 *
 * The file itself is the ambient entry point `/// <reference types="vite/client" />`;
 * its "public behavior" is the set of module-transform and ambient-type capabilities
 * Vite injects into the environment. Each capability below is exercised through its
 * observable runtime contract, plus a drift guard asserting the declaration file is
 * not silently altered.
 */

const env = import.meta.env

describe('vite-env.d.ts — vite/client ambient contract', () => {
  describe('import.meta.env (Env / ImportMetaEnv)', () => {
    it('is a non-null object provided by the environment', () => {
      expect(env).toBeTypeOf('object')
      expect(env).not.toBeNull()
    })

    it('exposes DEV as a boolean', () => {
      expect(env.DEV).toBeTypeOf('boolean')
    })

    it('exposes PROD as the strict complement of DEV', () => {
      // Observable invariant of the vite/client contract in any single environment.
      expect(env.PROD).toBe(!env.DEV)
    })

    it('exposes MODE as a non-empty string (defaults to "test" under Vitest)', () => {
      expect(env.MODE).toBeTypeOf('string')
      expect(env.MODE.length).toBeGreaterThan(0)
      expect(env.MODE).toBe('test')
    })

    it('exposes BASE_URL as the root base path', () => {
      // vite.config.ts defines no custom `base`, so the contract default is '/'.
      expect(env.BASE_URL).toBe('/')
    })

    it('exposes SSR as false in the client-side test environment', () => {
      expect(env.SSR).toBe(false)
    })

    it('declares all five core vite/client environment keys', () => {
      expect(Object.keys(env)).toEqual(
        expect.arrayContaining(['DEV', 'PROD', 'MODE', 'BASE_URL', 'SSR']),
      )
    })

    it('returns undefined (without throwing) for unknown custom env keys', () => {
      // Invalid-input path: reading a VITE_-style variable that was never injected
      // must be a safe, deterministic undefined — the ImportMetaEnv index signature.
      const unknown = (env as Record<string, unknown>)['VITE_DEFINITELY_NOT_INJECTED_PROBE']
      expect(unknown).toBeUndefined()
    })
  })

  describe('import.meta.hot (ViteHotContext)', () => {
    it('is defined in the module-runner test context', () => {
      expect(import.meta.hot).toBeDefined()
    })

    it('exposes the documented HMR API surface', () => {
      // The methods declared on ViteHotContext by vite/client. (`hot.data` only
      // materializes in the browser dev-server runtime, so it is not asserted here.)
      const hot = import.meta.hot!
      expect(hot.accept).toBeTypeOf('function')
      expect(hot.dispose).toBeTypeOf('function')
      expect(hot.prune).toBeTypeOf('function')
      expect(hot.invalidate).toBeTypeOf('function')
      expect(hot.on).toBeTypeOf('function')
      expect(hot.send).toBeTypeOf('function')
    })

    it('treats decline() as a non-declared runtime extra in Vite 5', () => {
      // vite/client stopped declaring `decline` on ViteHotContext in Vite 5,
      // while the module runner still provides it. The declared contract must
      // not depend on it — access it only through an index signature.
      const extra = (import.meta.hot as unknown as Record<string, unknown>).decline
      if (extra !== undefined) {
        expect(extra).toBeTypeOf('function')
      }
    })

    it('tolerates a bare accept() registration without throwing', () => {
      // Boundary path: registering self-accept with no callback and no dependencies
      // is legal and must be side-effect free and deterministic.
      expect(() => import.meta.hot!.accept()).not.toThrow()
    })
  })

  describe('import.meta.glob (ImportGlobFunction)', () => {
    it('is provided as a function', () => {
      expect(import.meta.glob).toBeTypeOf('function')
    })

    it('maps matching modules to lazy dynamic-import loaders', () => {
      const modules = import.meta.glob('../hooks/*.ts') as Record<string, unknown>
      const entries = Object.values(modules)

      expect(entries.length).toBeGreaterThan(0)
      for (const loader of entries) {
        expect(loader).toBeTypeOf('function')
      }
      expect(Object.keys(modules)).toContain('../hooks/useOnlineStatus.ts')
    })

    it('resolves a lazy loader to the real module with its named exports', async () => {
      const modules = import.meta.glob('../hooks/*.ts') as Record<
        string,
        () => Promise<Record<string, unknown>>
      >
      const loader = modules['../hooks/useOnlineStatus.ts']

      const mod = await loader!()

      expect(typeof mod.useOnlineStatus).toBe('function')
    })

    it('supports eager raw-source loading returning string contents', () => {
      // Success path for the { query: '?raw', import: 'default', eager: true } shape.
      const sources = import.meta.glob('../hooks/*.ts', {
        query: '?raw',
        import: 'default',
        eager: true,
      }) as Record<string, string>

      const onlineStatusSource = sources['../hooks/useOnlineStatus.ts']
      expect(onlineStatusSource).toBeTypeOf('string')
      expect(onlineStatusSource).toContain('export function useOnlineStatus')
    })

    it('returns an empty record (not a throw) for a pattern that matches nothing', () => {
      // Failure/boundary path: a glob with no matches stays a safe, deterministic {}.
      const none = import.meta.glob('/nonexistent/**/*.xyz') as Record<string, unknown>
      expect(none).toBeTypeOf('object')
      expect(Object.keys(none)).toHaveLength(0)
    })
  })

  describe('?raw and ?url module suffixes', () => {
    it('?raw returns the verbatim source text of the module', () => {
      expect(rawSource).toBeTypeOf('string')
      expect(rawSource.length).toBeGreaterThan(0)
      expect(rawSource).toContain('export function useOnlineStatus')
    })

    it('?url resolves a source file to its served path', () => {
      expect(tsUrl).toBeTypeOf('string')
      expect(tsUrl).toBe('/src/hooks/useOnlineStatus.ts')
    })
  })

  describe('static asset imports (*.svg)', () => {
    it('imports a small SVG as an inlined data URI string', () => {
      // Vite inlines assets below assetsInlineLimit (4096 B default);
      // favicon.svg is under that limit, so the contract yields a data URI.
      expect(svgInline).toBeTypeOf('string')
      expect(svgInline.startsWith('data:image/svg+xml')).toBe(true)
    })

    it('?url of the same asset yields the identical inlined data URI', () => {
      expect(svgUrl).toBeTypeOf('string')
      expect(svgUrl.startsWith('data:image/svg+xml')).toBe(true)
      expect(svgUrl).toBe(svgInline)
    })
  })

  describe('ambient declaration drift guard', () => {
    const declaration = readFileSync(resolve(process.cwd(), 'src/vite-env.d.ts'), 'utf8')

    it('contains exactly the vite/client reference directive', () => {
      // Guards the fixture's public contract: if the ambient entry point is edited,
      // this suite fails loudly instead of letting capabilities silently disappear.
      expect(declaration.trim()).toBe('/// <reference types="vite/client" />')
    })

    it('declares no additional reference directives', () => {
      const directives = declaration.match(/\/\/\/\s*<reference/g) ?? []
      expect(directives).toHaveLength(1)
    })
  })
})
