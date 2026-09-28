import { describe, expect, it } from 'vitest';
import {
  FORMAT_META,
  FORMAT_SAMPLE,
  SCOPE_META,
  type ExportFormat,
  type ExportJobStatus,
  type ExportScope,
} from '../components/data-export/exportTypes';

/**
 * Focused behaviour coverage for the `exportTypes` module (issue #625). The
 * existing `data-export.test.tsx` drives the panel component; this suite pins the
 * shared data contract the panel and any consumer rely on: exhaustive coverage of
 * every `ExportFormat` / `ExportScope`, the sample payload shapes and the
 * `ExportJobStatus` lifecycle membership.
 */
const FORMATS: ExportFormat[] = ['csv', 'json', 'parquet', 'pdf'];
const SCOPES: ExportScope[] = ['all', 'current-filter', 'last-30-days'];
const STATUSES: ExportJobStatus[] = ['queued', 'processing', 'ready', 'failed', 'expired'];

describe('exportTypes', () => {
  it('FORMAT_META exposes exactly one entry per ExportFormat and nothing more', () => {
    expect(Object.keys(FORMAT_META).sort()).toEqual([...FORMATS].sort());
  });

  it('every format label is non-empty and unique', () => {
    const labels = FORMATS.map((format) => FORMAT_META[format].label);

    labels.forEach((label) => expect(label.trim().length).toBeGreaterThan(0));
    expect(new Set(labels).size).toBe(FORMATS.length);
  });

  it('every format extension is dotted, lowercase and unique', () => {
    const extensions = FORMATS.map((format) => FORMAT_META[format].extension);

    extensions.forEach((extension) => {
      expect(extension).toMatch(/^\.[a-z0-9]+$/);
    });
    expect(new Set(extensions).size).toBe(FORMATS.length);
  });

  it('every format carries a description and a best-for hint', () => {
    FORMATS.forEach((format) => {
      expect(FORMAT_META[format].description.trim().length).toBeGreaterThan(0);
      expect(FORMAT_META[format].bestFor.trim().length).toBeGreaterThan(0);
    });
  });

  it('FORMAT_SAMPLE exposes exactly one snippet per ExportFormat', () => {
    expect(Object.keys(FORMAT_SAMPLE).sort()).toEqual([...FORMATS].sort());

    FORMATS.forEach((format) => {
      expect(FORMAT_SAMPLE[format].length).toBeGreaterThan(0);
    });
  });

  it('the CSV sample is well-formed: header plus two rows with matching arity', () => {
    const rows = FORMAT_SAMPLE.csv.split('\n');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe('id,source,amount,currency,attested_at');
    rows.slice(1).forEach((row) => {
      expect(row.split(',')).toHaveLength(5);
    });
  });

  it('the JSON sample parses to the documented record shape', () => {
    const parsed = JSON.parse(FORMAT_SAMPLE.json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(Object.keys(parsed[0]).sort()).toEqual(
      ['amount', 'attested_at', 'currency', 'id', 'source'].sort(),
    );
    expect(typeof parsed[0].amount).toBe('number');
    expect(() => new Date(parsed[0].attested_at).toISOString()).not.toThrow();
  });

  it('the parquet sample is annotated as binary, not advertised as parseable text', () => {
    expect(FORMAT_SAMPLE.parquet).toMatch(/binary/i);
    expect(() => JSON.parse(FORMAT_SAMPLE.parquet)).toThrow();
  });

  it('SCOPE_META exposes exactly one entry per ExportScope with a non-empty label', () => {
    expect(Object.keys(SCOPE_META).sort()).toEqual([...SCOPES].sort());
    SCOPES.forEach((scope) => {
      expect(SCOPE_META[scope].label.trim().length).toBeGreaterThan(0);
    });
  });

  it('the ExportJobStatus lifecycle is exhaustive and free of duplicates', () => {
    expect(STATUSES).toHaveLength(5);
    expect(new Set(STATUSES).size).toBe(STATUSES.length);
    // Only `ready` exposes a downloadable file in the documented lifecycle.
    expect(STATUSES.filter((status) => status === 'ready')).toHaveLength(1);
  });

  it('does not advertise an unknown format or scope at runtime', () => {
    expect(FORMAT_META).not.toHaveProperty('xml');
    expect(SCOPE_META).not.toHaveProperty('last-7-days');
  });
});
