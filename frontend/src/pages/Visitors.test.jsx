/**
 * Smoke test for the Visitors page: ensures the component loads and renders
 * without throwing (e.g. ReferenceError like "cum is not defined" or TDZ errors).
 * API calls are mocked so no backend is required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Visitors from "./Visitors";

vi.mock("../api/axios", () => {
  const mockGet = (url) => {
    const u = String(url);
    let data = null;
    if (url === "/api/visitors") data = [];
    else if (u.includes("daily-trends")) data = [];
    else if (u.includes("sessions")) data = { activeUsers: 0, engagedUsers: 0 };
    else if (u.includes("top-pages")) data = [];
    else if (u.includes("traffic-sources")) data = { sessionSources: [] };
    else if (u.includes("audience")) data = { geographic: [], device: [], hourly: [] };
    else if (u.includes("daily-traffic-by-source")) data = { daily: [] };
    else if (u.includes("source-analysis")) data = { summary: {}, topLandingPages: [] };
    return Promise.resolve({ data: { success: true, data } });
  };
  return { default: { get: vi.fn(mockGet) } };
});

describe("Visitors page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and renders without throwing", () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={["/visitors"]}>
          <Visitors />
        </MemoryRouter>
      );
    }).not.toThrow();
  });

  it("shows Overview tab after initial render", async () => {
    render(
      <MemoryRouter initialEntries={["/visitors"]}>
        <Visitors />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeInTheDocument();
    });
  });

  it("renders overview content without reference errors", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/visitors"]}>
        <Visitors />
      </MemoryRouter>
    );

    await waitFor(() => {
      const hasContent =
        container.textContent?.includes("Traffic") ||
        container.textContent?.includes("Sources") ||
        container.textContent?.includes("Overview");
      expect(hasContent).toBe(true);
    }, { timeout: 3000 });
  });
});
