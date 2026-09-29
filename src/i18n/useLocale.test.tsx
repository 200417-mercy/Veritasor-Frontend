import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLocale } from './useLocale'
import { LocaleProvider } from './provider'
import { LOCALE_STORAGE_KEY } from './config'

describe('useLocale', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ''
    document.documentElement.dir = ''
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  
  it('exposes locale, dir, and formatting functions', () => {
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider })
    expect(result.current.locale).toBe('en')
    expect(result.current.dir).toBe('ltr')
    expect(typeof result.current.setLocale).toBe('function')
    expect(typeof result.current.formatDate).toBe('function')
    expect(typeof result.current.formatNumber).toBe('function')
    expect(typeof result.current.formatCurrency).toBe('function')
  })

  it('formats dates correctly according to the current locale', () => {
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider })
    const testDate = new Date('2023-01-01T12:00:00Z')
    
    // Test formatting with 'en' locale
    const formattedShort = result.current.formatDate(testDate, 'short')
    expect(typeof formattedShort).toBe('string')
    expect(formattedShort).toMatch(/23/)

    const formattedMedium = result.current.formatDate(testDate, 'medium')
    expect(typeof formattedMedium).toBe('string')
    expect(formattedMedium).toMatch(/2023/)
  })

  it('formats numbers correctly according to the current locale', () => {
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider })
    
    const formatted = result.current.formatNumber(1234.56)
    expect(typeof formatted).toBe('string')
    expect(formatted.replace(/\s/g, '')).toMatch(/1,?234\.56/)
  })

  it('formats currency correctly according to the current locale', () => {
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider })
    
    const formatted = result.current.formatCurrency(1234.56, 'USD')
    expect(typeof formatted).toBe('string')
    expect(formatted).toMatch(/\$|USD/)
  })

  it('updates locale and formatting when setLocale is called', () => {
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider })
    
    act(() => {
      result.current.setLocale('es')
    })

    expect(result.current.locale).toBe('es')
    expect(result.current.dir).toBe('ltr')
    
    act(() => {
      result.current.setLocale('ar')
    })

    expect(result.current.locale).toBe('ar')
    expect(result.current.dir).toBe('rtl')
  })

  it('handles unsupported locales gracefully by falling back to default', () => {
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider })
    
    act(() => {
      result.current.setLocale('invalid-locale')
    })
    
    expect(result.current.locale).toBe('en') // fallback locale
  })
  
  it('throws an error for invalid date objects in formatDate', () => {
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider })
    
    expect(() => {
      result.current.formatDate(new Date('invalid date string'))
    }).toThrow('Invalid time value')
  })

  it('throws an error or returns NaN string for invalid numbers in formatNumber', () => {
    const { result } = renderHook(() => useLocale(), { wrapper: LocaleProvider })
    
    // react-intl formatNumber handles NaN by returning a specific format, we just check it doesn't crash unless strictly specified
    const formatted = result.current.formatNumber(NaN)
    expect(typeof formatted).toBe('string')
    expect(formatted).toMatch(/NaN/i)
  })
})
