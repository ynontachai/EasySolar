import "server-only";

const WORKFLOW_FILE = "datasheet-scanner.yml";
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export type ScanDispatchResult =
  | { queued: true; reason: "queued" }
  | { queued: false; reason: "failed" | "not_configured" };

export function isScannerDispatchConfigured() {
  return Boolean(
    process.env.EASYSOLAR_SCANNER_GITHUB_TOKEN &&
      process.env.EASYSOLAR_SCANNER_GITHUB_REPOSITORY &&
      GITHUB_REPOSITORY_PATTERN.test(
        process.env.EASYSOLAR_SCANNER_GITHUB_REPOSITORY,
      ),
  );
}

export async function dispatchDatasheetScanner(): Promise<ScanDispatchResult> {
  const token = process.env.EASYSOLAR_SCANNER_GITHUB_TOKEN;
  const repository = process.env.EASYSOLAR_SCANNER_GITHUB_REPOSITORY;
  const ref = process.env.EASYSOLAR_SCANNER_GITHUB_REF || "main";

  if (!token || !repository || !GITHUB_REPOSITORY_PATTERN.test(repository)) {
    return { queued: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        body: JSON.stringify({ ref }),
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-github-api-version": "2022-11-28",
        },
        method: "POST",
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (response.status === 204) return { queued: true, reason: "queued" };

    console.error("Datasheet scanner dispatch rejected", {
      repository,
      status: response.status,
    });
    return { queued: false, reason: "failed" };
  } catch (error) {
    console.error("Datasheet scanner dispatch failed", {
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      repository,
    });
    return { queued: false, reason: "failed" };
  }
}
