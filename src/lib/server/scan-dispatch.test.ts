import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  dispatchDatasheetScanner,
  isScannerDispatchConfigured,
} from "./scan-dispatch";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("datasheet scanner dispatch", () => {
  it("reports missing configuration without making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(isScannerDispatchConfigured()).toBe(false);
    await expect(dispatchDatasheetScanner()).resolves.toEqual({
      queued: false,
      reason: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches the scanner workflow on the configured branch", async () => {
    vi.stubEnv("EASYSOLAR_SCANNER_GITHUB_TOKEN", "test-token");
    vi.stubEnv("EASYSOLAR_SCANNER_GITHUB_REPOSITORY", "ynontachai/EasySolar");
    vi.stubEnv("EASYSOLAR_SCANNER_GITHUB_REF", "main");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(isScannerDispatchConfigured()).toBe(true);
    await expect(dispatchDatasheetScanner()).resolves.toEqual({
      queued: true,
      reason: "queued",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/ynontachai/EasySolar/actions/workflows/datasheet-scanner.yml/dispatches",
      expect.objectContaining({
        body: JSON.stringify({ ref: "main" }),
        method: "POST",
      }),
    );
  });

  it("does not dispatch to an invalid repository value", async () => {
    vi.stubEnv("EASYSOLAR_SCANNER_GITHUB_TOKEN", "test-token");
    vi.stubEnv("EASYSOLAR_SCANNER_GITHUB_REPOSITORY", "https://example.com/repo");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(dispatchDatasheetScanner()).resolves.toEqual({
      queued: false,
      reason: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
