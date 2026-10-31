import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.EASYSOLAR_BASE_URL?.replace(/\/$/, "");
const scannerToken = process.env.EASYSOLAR_SCANNER_TOKEN;
const batchSize = Number(process.env.EASYSOLAR_SCAN_BATCH_SIZE ?? 10);
const maxJobs = Number(process.env.EASYSOLAR_SCAN_MAX_JOBS ?? 100);

if (!baseUrl) throw new Error("EASYSOLAR_BASE_URL_MISSING");
if (!scannerToken) throw new Error("EASYSOLAR_SCANNER_TOKEN_MISSING");
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 25) {
  throw new Error("EASYSOLAR_SCAN_BATCH_SIZE_INVALID");
}

const authHeaders = {
  authorization: `Bearer ${scannerToken}`,
  "content-type": "application/json",
};

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? `HTTP_${response.status}`);
  return body;
}

async function claimJobs() {
  const response = await fetch(`${baseUrl}/api/v1/admin/datasheets/scan-jobs`, {
    body: JSON.stringify({ limit: batchSize }),
    headers: authHeaders,
    method: "POST",
  });
  const body = await readJson(response);
  return body.jobs ?? [];
}

async function sendVerdict(assetId, verdict, scanner, details) {
  const response = await fetch(
    `${baseUrl}/api/v1/admin/datasheets/${assetId}/scan-verdict`,
    {
      body: JSON.stringify({ details, scanner, verdict }),
      headers: authHeaders,
      method: "POST",
    },
  );
  return readJson(response);
}

async function getScannerVersion() {
  const { stdout } = await execFileAsync("clamscan", ["--version"]);
  return stdout.trim().slice(0, 100);
}

function getInfectionName(output) {
  const match = output.match(/:\s+(.+)\s+FOUND\s*$/m);
  return match?.[1]?.trim() ?? "unknown";
}

async function scanJob(job, scanner) {
  const startedAt = new Date().toISOString();
  const directory = await mkdtemp(path.join(tmpdir(), "easysolar-scan-"));
  const filePath = path.join(directory, "datasheet.pdf");

  try {
    const response = await fetch(job.downloadUrl);
    if (!response.ok) throw new Error(`DOWNLOAD_HTTP_${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== job.sizeBytes) throw new Error("SIZE_MISMATCH");
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("PDF_MAGIC_BYTES_INVALID");
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== job.sha256) throw new Error("SHA256_MISMATCH");
    await writeFile(filePath, bytes, { mode: 0o600 });

    try {
      await execFileAsync("clamscan", ["--infected", "--no-summary", filePath]);
      return sendVerdict(job.assetId, "clean", scanner, {
        filename: job.filename,
        finishedAt: new Date().toISOString(),
        sha256,
        startedAt,
      });
    } catch (error) {
      if (error?.code === 1) {
        return sendVerdict(job.assetId, "infected", scanner, {
          filename: job.filename,
          finishedAt: new Date().toISOString(),
          infection: getInfectionName(`${error.stdout ?? ""}\n${error.stderr ?? ""}`),
          sha256,
          startedAt,
        });
      }
      throw error;
    }
  } catch (error) {
    await sendVerdict(job.assetId, "error", scanner, {
      error: error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN_SCAN_ERROR",
      filename: job.filename,
      finishedAt: new Date().toISOString(),
      startedAt,
    });
    return null;
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

const scanner = await getScannerVersion();
let processed = 0;
let hasRetryableError = false;

while (processed < maxJobs) {
  const jobs = await claimJobs();
  if (jobs.length === 0) break;
  for (const job of jobs) {
    const result = await scanJob(job, scanner);
    if (result === null) hasRetryableError = true;
    processed += 1;
    if (processed >= maxJobs) break;
  }
  if (hasRetryableError) break;
}

console.log(`Processed ${processed} unique datasheet checksum(s) with ${scanner}`);
