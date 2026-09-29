import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import DensityToggle from "./DensityToggle";

describe("DensityToggle", () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url: any, options?: RequestInit) => {
      return {
        ok: true,
        json: async () => ({ density: "comfortable" }),
      } as Response;
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders correctly with default state", () => {
    render(<DensityToggle workspace="test-ws" />);
    
    const group = screen.getByRole("radiogroup", { name: "Display density" });
    expect(group).toBeInTheDocument();
    
    const comfortable = screen.getByRole("radio", { name: /Comfortable/i });
    const compact = screen.getByRole("radio", { name: /Compact/i });
    
    expect(comfortable).toBeInTheDocument();
    expect(compact).toBeInTheDocument();
    
    expect(comfortable).toHaveAttribute("aria-checked", "true");
    expect(compact).toHaveAttribute("aria-checked", "false");
  });

  it("changes state to compact when clicked", async () => {
    render(<DensityToggle workspace="test-ws" />);
    
    const compact = screen.getByRole("radio", { name: /Compact/i });
    fireEvent.click(compact);
    
    expect(compact).toHaveAttribute("aria-checked", "true");
    
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/preferences/density"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ workspace: "test-ws", density: "compact" }),
      })
    );
  });

  it("handles server failure and rolls back state", async () => {
    fetchMock.mockImplementation(async (url: any, options?: RequestInit) => {
      if (options?.method === 'PUT') {
         return { ok: false } as Response;
      }
      return { ok: true, json: async () => ({ density: "comfortable" }) } as Response;
    });
    
    const onPersistError = vi.fn();
    render(<DensityToggle workspace="test-ws" onPersistError={onPersistError} />);
    
    const compact = screen.getByRole("radio", { name: /Compact/i });
    fireEvent.click(compact);
    
    // optimistically sets to true
    expect(compact).toHaveAttribute("aria-checked", "true");
    
    await waitFor(() => {
      expect(onPersistError).toHaveBeenCalledWith("Could not save density preference. Changes reverted.");
    });
    
    const comfortable = screen.getByRole("radio", { name: /Comfortable/i });
    expect(comfortable).toHaveAttribute("aria-checked", "true");
    expect(compact).toHaveAttribute("aria-checked", "false");
  });

  it("handles network error and rolls back state", async () => {
    fetchMock.mockImplementation(async (url: any, options?: RequestInit) => {
      if (options?.method === 'PUT') {
         return Promise.reject(new Error("Network Error"));
      }
      return { ok: true, json: async () => ({ density: "comfortable" }) } as Response;
    });
    
    const onPersistError = vi.fn();
    render(<DensityToggle workspace="test-ws" onPersistError={onPersistError} />);
    
    const compact = screen.getByRole("radio", { name: /Compact/i });
    fireEvent.click(compact);
    
    await waitFor(() => {
      expect(onPersistError).toHaveBeenCalledWith("Could not save density preference. Changes reverted.");
    });
    
    const comfortable = screen.getByRole("radio", { name: /Comfortable/i });
    expect(comfortable).toHaveAttribute("aria-checked", "true");
  });

  it("works gracefully when onPersistError is not provided and an error occurs", async () => {
    fetchMock.mockImplementation(async (url: any, options?: RequestInit) => {
      if (options?.method === 'PUT') {
         return { ok: false } as Response;
      }
      return { ok: true, json: async () => ({ density: "comfortable" }) } as Response;
    });
    
    render(<DensityToggle workspace="test-ws" />);
    
    const compact = screen.getByRole("radio", { name: /Compact/i });
    fireEvent.click(compact);
    
    await waitFor(() => {
      const comfortable = screen.getByRole("radio", { name: /Comfortable/i });
      expect(comfortable).toHaveAttribute("aria-checked", "true");
    });
  });

  it("handles empty workspace prop (invalid input representation)", () => {
    render(<DensityToggle workspace="" />);
    const comfortable = screen.getByRole("radio", { name: /Comfortable/i });
    expect(comfortable).toBeInTheDocument();
  });
});
