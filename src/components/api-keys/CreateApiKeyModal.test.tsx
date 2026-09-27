import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateApiKeyModal from './CreateApiKeyModal';
import { ToastProvider } from '../ToastContext';

describe('CreateApiKeyModal', () => {
  const mockOnClose = vi.fn();
  const mockOnMinted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (open = true) => {
    return render(
      <ToastProvider>
        <CreateApiKeyModal open={open} onClose={mockOnClose} onMinted={mockOnMinted} />
      </ToastProvider>
    );
  };

  it('renders nothing when closed', () => {
    renderModal(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal content when open', () => {
    renderModal(true);
    expect(screen.getByRole('dialog', { name: /create api key/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expiry/i)).toBeInTheDocument();
  });

  it('validates minimum label length', () => {
    renderModal();
    const labelInput = screen.getByLabelText(/label/i);
    fireEvent.change(labelInput, { target: { value: 'a' } });

    const createBtn = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/Add a label \(at least 2 characters\)/);
    expect(mockOnMinted).not.toHaveBeenCalled();
  });

  it('validates expiry bounds', () => {
    renderModal();
    const expiryInput = screen.getByLabelText(/expiry/i);
    
    // Too small
    fireEvent.change(expiryInput, { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Expiry must be between 7 and 365 days/);

    // Too large
    fireEvent.change(expiryInput, { target: { value: '366' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Expiry must be between 7 and 365 days/);
  });

  it('validates scope selection minimum', () => {
    renderModal();
    
    // Clear all scopes
    const clearAllBtn = screen.getByRole('button', { name: /clear all scopes/i });
    fireEvent.click(clearAllBtn);

    const createBtn = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createBtn);

    expect(screen.getByRole('alert')).toHaveTextContent(/Select at least one scope/);
  });

  it('filters scopes by search query', () => {
    renderModal();
    
    const searchInput = screen.getByPlaceholderText(/filter scopes/i);
    fireEvent.change(searchInput, { target: { value: 'attestation' } });

    expect(screen.getByText('Attestations')).toBeInTheDocument();
    // Revenue sources should be filtered out
    expect(screen.queryByText('Revenue Sources')).not.toBeInTheDocument();
  });

  it('shows empty state when search matches nothing', () => {
    renderModal();
    
    const searchInput = screen.getByPlaceholderText(/filter scopes/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistentquery' } });

    expect(screen.getByRole('status')).toHaveTextContent(/No scopes match/);
  });

  it('selects all scopes', () => {
    renderModal();
    
    const selectAllBtn = screen.getByRole('button', { name: /select all scopes/i });
    fireEvent.click(selectAllBtn);
    
    // Total scopes length is 8 (4 groups * 2 scopes)
    expect(screen.getByText(/8 \/ 8 selected/)).toBeInTheDocument();
  });

  it('handles valid submission and confirmation', () => {
    renderModal();
    
    // Valid defaults exist, so click Create
    const createBtn = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createBtn);

    // Should open confirmation dialog
    const confirmDialog = screen.getByRole('dialog', { name: /confirm key creation/i });
    expect(confirmDialog).toBeInTheDocument();

    // Confirm minting
    const confirmBtn = screen.getByRole('button', { name: /create key/i }); // Confirm dialog has "Create key"
    fireEvent.click(confirmBtn);

    expect(mockOnMinted).toHaveBeenCalledTimes(1);
    expect(mockOnMinted).toHaveBeenCalledWith(expect.any(String), expect.any(String));
  });

  it('cancels confirmation dialog', () => {
    renderModal();
    
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    const confirmDialog = screen.getByRole('dialog', { name: /confirm key creation/i });
    expect(confirmDialog).toBeInTheDocument();

    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);

    expect(screen.queryByRole('dialog', { name: /confirm key creation/i })).not.toBeInTheDocument();
    expect(mockOnMinted).not.toHaveBeenCalled();
  });
  
  it('toggles a single scope', () => {
    renderModal();
    const readSourcesScope = screen.getByLabelText(/Read revenue sources/i);
    fireEvent.click(readSourcesScope);
    
    // Init state has 1 selected (read:attestations), now we selected another -> 2
    expect(screen.getByText(/2 \/ 8 selected/)).toBeInTheDocument();
  });

  it('toggles a whole group of scopes', () => {
    renderModal();
    // Assuming "Attestations" group checkbox
    const attestationsToggle = screen.getByLabelText(/Toggle all Attestations scopes/i);
    
    // Init state has 'read:attestations' selected. Toggling group should select the rest if it was 'some' or deselect if 'all'
    // It's 'some', so it should select all in Attestations
    fireEvent.click(attestationsToggle);
    expect(screen.getByText(/2 \/ 8 selected/)).toBeInTheDocument(); // write:attestations also selected
    
    // Click again to deselect all in group
    fireEvent.click(attestationsToggle);
    expect(screen.getByText(/0 \/ 8 selected/)).toBeInTheDocument();
  });
});
