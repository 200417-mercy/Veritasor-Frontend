import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import FailedPaymentBanner, { type FailedPaymentInfo } from "./FailedPaymentBanner"

const failure: FailedPaymentInfo = {
  id: "failure-1",
  invoiceId: "INV-2025-02",
  invoicePeriod: "February 2025",
  amount: 1234.5,
  dueDate: "2025-02-14T12:00:00.000Z",
  failureReason: "Card declined",
  lastAttemptAt: "2025-02-14T12:00:00.000Z",
}

function renderBanner(info: FailedPaymentInfo | null, onDismiss?: () => void) {
  return render(
    <MemoryRouter>
      <FailedPaymentBanner failure={info} onDismiss={onDismiss} />
    </MemoryRouter>
  )
}

describe("FailedPaymentInfo and FailedPaymentBanner", () => {
  it("renders payment and invoice details with billing links", () => {
    renderBanner(failure)
    const formattedDueDate = new Date(failure.dueDate).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })

    expect(screen.getByRole("region", { name: "Payment failure notice" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Payment failed")
    expect(screen.getByText(`$1,234.50 due ${formattedDueDate}`)).toBeInTheDocument()
    expect(screen.getByText(/Your February 2025 invoice \(INV-2025-02\) could not be charged/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Update payment method to resolve failed payment" }))
      .toHaveAttribute("href", "/settings#billing")
    expect(screen.getByRole("link", { name: "View invoice INV-2025-02 for February 2025" }))
      .toHaveAttribute("href", "/settings#billing")
  })

  it("transitions from no failure to a populated failure", () => {
    const { rerender } = renderBanner(null)

    expect(screen.queryByRole("region", { name: "Payment failure notice" })).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <FailedPaymentBanner failure={failure} />
      </MemoryRouter>
    )

    expect(screen.getByRole("region", { name: "Payment failure notice" })).toBeInTheDocument()
  })

  it("dismisses the notice and calls the optional callback", () => {
    const onDismiss = vi.fn()
    renderBanner(failure, onDismiss)

    fireEvent.click(screen.getByRole("button", { name: "Dismiss payment failure notice" }))

    expect(screen.queryByRole("region", { name: "Payment failure notice" })).not.toBeInTheDocument()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("dismisses without an optional callback", () => {
    renderBanner(failure)

    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Dismiss payment failure notice" }))
    ).not.toThrow()
    expect(screen.queryByRole("region", { name: "Payment failure notice" })).not.toBeInTheDocument()
  })

  it("renders malformed amount and date values deterministically", () => {
    renderBanner({ ...failure, amount: Number.NaN, dueDate: "not-a-date" })

    expect(screen.getByText("$NaN due Invalid Date")).toBeInTheDocument()
  })
})