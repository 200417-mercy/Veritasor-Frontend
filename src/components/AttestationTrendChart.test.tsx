import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AttestationTrendChart from './AttestationTrendChart';
import { aggregateAttestationTrend } from '../utils/attestationChartData';

const sampleData = [
  { date: '2025-03-01', verified: 1, pending: 0, failed: 0, total: 1 },
  { date: '2025-03-02', verified: 1, pending: 1, failed: 0, total: 2 },
  { date: '2025-03-03', verified: 0, pending: 0, failed: 1, total: 1 },
];

describe('AttestationTrendChart', () => {
  it('renders heading, legend, and chart', () => {
    render(<AttestationTrendChart data={sampleData} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Attestation history' })).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('toggles to table view and back', () => {
    render(<AttestationTrendChart data={sampleData} />);
    fireEvent.click(screen.getByRole('button', { name: 'View as table' }));
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(within(table).getByText('2025-03-02')).toBeInTheDocument();
    expect(within(table).getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'View as chart' }));
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows empty state message when no data is provided', () => {
    render(<AttestationTrendChart data={[]} />);
    expect(screen.getByText('No attestation data available for this period.')).toBeInTheDocument();
  });

  it('omits non-positive status segments while retaining the bar outcome', () => {
    render(
      <AttestationTrendChart
        data={[{ date: '2025-03-04', verified: 0, pending: 0, failed: 0, total: 0 }]}
      />,
    );

    const bar = screen.getByRole('button', { name: /2025-03-04: verified 0/i });
    expect(bar.querySelectorAll('rect')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('Hover or focus a bar for details.');
  });
});

describe('aggregateAttestationTrend', () => {
  it('groups records by date and status', () => {
    const result = aggregateAttestationTrend([
      { status: 'Verified', date: '2025-03-01' },
      { status: 'Pending', date: '2025-03-02' },
      { status: 'Revoked', date: '2025-03-02' },
      { status: 'In review', date: '2025-03-02' },
    ]);
    expect(result).toEqual([
      { date: '2025-03-01', verified: 1, pending: 0, failed: 0, total: 1 },
      { date: '2025-03-02', verified: 0, pending: 2, failed: 1, total: 3 },
    ]);
  });

  it('handles empty and invalid inputs', () => {
    expect(aggregateAttestationTrend([])).toEqual([]);
    const result = aggregateAttestationTrend([{ status: 'Verified' }]);
    expect(result).toEqual([
      { date: 'Unknown', verified: 1, pending: 0, failed: 0, total: 1 },
    ]);
  });
});
