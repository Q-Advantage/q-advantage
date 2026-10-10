import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/subscribe/route";
const request = (body: unknown) => new Request("https://test.invalid/api/subscribe", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
beforeEach(() => { vi.stubEnv("BEEHIIV_API_KEY", ""); vi.stubEnv("BEEHIIV_PUB_ID", ""); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Subscription handling without real subscriber data", () => {
  it("rejects malformed requests without contacting Beehiiv", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const body of [null, {}, { email: 9999 }, { email: "invalid" }]) expect((await POST(request(body))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports missing configuration honestly", async () => {
    const response = await POST(request({ email: "test@example.invalid" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.stringContaining("temporarily unavailable") });
  });
  it("normalizes the address and keeps credentials server-side", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "TEST_ONLY_NOT_A_KEY"); vi.stubEnv("BEEHIIV_PUB_ID", "TEST_ONLY_NOT_A_PUBLICATION");
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetch);
    const response = await POST(request({ email: " Test@Example.invalid " }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true });
    expect(JSON.parse(fetch.mock.calls[0][1].body).email).toBe("test@example.invalid");
  });
  it("does not expose raw provider errors", async () => {
    vi.stubEnv("BEEHIIV_API_KEY", "TEST_ONLY_NOT_A_KEY"); vi.stubEnv("BEEHIIV_PUB_ID", "TEST_ONLY_NOT_A_PUBLICATION");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: "PRIVATE_TEST_DETAIL" }] }), { status: 401 })));
    const response = await POST(request({ email: "test@example.invalid" }));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain("PRIVATE_TEST_DETAIL");
  });
});
