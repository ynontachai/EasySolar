import { describe, expect, it } from "vitest";
import { HttpError, parseJsonRequest } from "./http-error";

describe("parseJsonRequest", () => {
  it("returns a valid JSON payload", async () => {
    const request = new Request("https://example.test", {
      body: JSON.stringify({ revision: "R1" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    await expect(parseJsonRequest(request)).resolves.toEqual({ revision: "R1" });
  });

  it("maps malformed JSON to a client error", async () => {
    const request = new Request("https://example.test", {
      body: "{invalid",
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    await expect(parseJsonRequest(request)).rejects.toMatchObject<
      Partial<HttpError>
    >({
      code: "INVALID_JSON",
      status: 400,
    });
  });
});
