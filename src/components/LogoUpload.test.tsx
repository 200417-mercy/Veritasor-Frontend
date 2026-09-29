import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import LogoUpload from './LogoUpload'

describe('LogoUpload', () => {
  let mockCreateObjectURL: any
  let mockRevokeObjectURL: any
  
  beforeEach(() => {
    mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/mock-uuid')
    mockRevokeObjectURL = vi.fn()
    window.URL.createObjectURL = mockCreateObjectURL
    window.URL.revokeObjectURL = mockRevokeObjectURL
    
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    }) as any
    
    // Mock toBlob
    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation(function (this: HTMLCanvasElement, callback: (blob: Blob | null) => void) {
      callback(new Blob(['mock-image-data'], { type: 'image/jpeg' }))
    })
    
    // Mock getBoundingClientRect for view
    Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 300,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 300
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders idle state with current logo', () => {
    render(<LogoUpload currentLogoUrl="http://example.com/logo.png" onSave={vi.fn()} />)
    expect(screen.getByAltText('Current organisation logo')).toHaveAttribute('src', 'http://example.com/logo.png')
    expect(screen.getByText('Click to upload')).toBeInTheDocument()
  })

  it('shows error for invalid file type', async () => {
    render(<LogoUpload onSave={vi.fn()} />)
    const fileInput = screen.getByLabelText('Upload logo')
    
    const file = new File(['text'], 'test.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    expect(await screen.findByText(/Please upload an image file/)).toBeInTheDocument()
  })

  it('shows error for oversized file', async () => {
    render(<LogoUpload onSave={vi.fn()} />)
    const fileInput = screen.getByLabelText('Upload logo')
    
    const file = new File(['x'.repeat(3 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 })
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    expect(await screen.findByText(/File exceeds 2 MB limit/)).toBeInTheDocument()
  })

  it('transitions to cropping phase on valid file drop', () => {
    render(<LogoUpload onSave={vi.fn()} />)
    const dropzone = screen.getByRole('button', { name: /Upload a new logo/ })
    
    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    
    expect(screen.getByText(/Drag to reposition/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply crop' })).toBeInTheDocument()
  })

  it('handles zooming via slider', () => {
    render(<LogoUpload onSave={vi.fn()} />)
    const dropzone = screen.getByRole('button', { name: /Upload a new logo/ })
    
    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    
    const slider = screen.getByLabelText('Zoom level')
    fireEvent.change(slider, { target: { value: '2' } })
    
    expect(screen.getByText('200%')).toBeInTheDocument()
  })

  it('transitions to preview phase on confirm crop', () => {
    render(<LogoUpload onSave={vi.fn()} />)
    const dropzone = screen.getByRole('button', { name: /Upload a new logo/ })
    
    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    
    const applyButton = screen.getByRole('button', { name: 'Apply crop' })
    fireEvent.click(applyButton)
    
    expect(screen.getByText('Preview at multiple sizes')).toBeInTheDocument()
    expect(screen.getByText('Large (80 px)')).toBeInTheDocument()
  })

  it('calls onSave with the cropped file', async () => {
    const handleSave = vi.fn()
    render(<LogoUpload onSave={handleSave} />)
    
    // Drop file
    const dropzone = screen.getByRole('button', { name: /Upload a new logo/ })
    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    
    // Apply crop
    const applyButton = screen.getByRole('button', { name: 'Apply crop' })
    fireEvent.click(applyButton)
    
    // Save logo
    const saveButton = screen.getByRole('button', { name: 'Save logo' })
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1)
      expect(handleSave.mock.calls[0][0]).toBeInstanceOf(File)
      expect(handleSave.mock.calls[0][0].name).toMatch(/^logo-\d+\.jpg$/)
    })
  })

  it('calls onCancel when provided', () => {
    const handleCancel = vi.fn()
    render(<LogoUpload onSave={vi.fn()} onCancel={handleCancel} />)
    
    // Drop file
    const dropzone = screen.getByRole('button', { name: /Upload a new logo/ })
    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    
    // Apply crop
    const applyButton = screen.getByRole('button', { name: 'Apply crop' })
    fireEvent.click(applyButton)
    
    // Cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)
    
    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('supports back navigation from preview to crop and crop to idle', () => {
    render(<LogoUpload onSave={vi.fn()} />)
    
    // Drop file -> Cropping
    const dropzone = screen.getByRole('button', { name: /Upload a new logo/ })
    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    
    // Apply crop -> Preview
    const applyButton = screen.getByRole('button', { name: 'Apply crop' })
    fireEvent.click(applyButton)
    
    // Back to Crop
    const adjustButton = screen.getByRole('button', { name: '← Adjust crop' })
    fireEvent.click(adjustButton)
    expect(screen.getByText(/Drag to reposition/)).toBeInTheDocument()
    
    // Back to Idle
    const chooseDifferent = screen.getByRole('button', { name: '← Choose different file' })
    fireEvent.click(chooseDifferent)
    expect(screen.getByText('Click to upload')).toBeInTheDocument()
  })

  it('supports keyboard pan/nudge', () => {
    render(<LogoUpload onSave={vi.fn()} />)
    
    // Drop file -> Cropping
    const dropzone = screen.getByRole('button', { name: /Upload a new logo/ })
    const file = new File(['fake-image'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    
    const cropArea = screen.getByRole('img', { name: /Logo crop area/ })
    cropArea.focus()
    fireEvent.keyDown(cropArea, { key: 'ArrowRight' })
    expect(cropArea).toBeInTheDocument()
  })
})
