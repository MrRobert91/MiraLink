import { buildApiUrl, getProfile, updateProfile } from "./api";
import { defaultMiraLinkPreferences } from "../types";

describe("api url builder", () => {
  beforeEach(() => {
    window.__APP_CONFIG__ = { VITE_API_BASE_URL: "https://api.example.com" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.__APP_CONFIG__ = undefined;
  });

  it("joins a public base url with an api path", () => {
    expect(buildApiUrl("https://api.example.com/", "/api/forms/import")).toBe(
      "https://api.example.com/api/forms/import",
    );
  });

  it("throws when no api base url is configured", () => {
    expect(() => buildApiUrl("", "/api/forms/import")).toThrow("VITE_API_BASE_URL");
  });

  it("loads the fixed MiraLink profile preferences", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: "miralink-default",
          preferences: defaultMiraLinkPreferences,
          quick_phrases: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const profile = await getProfile();

    expect(profile.user_id).toBe("miralink-default");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/profiles/miralink-default"),
    );
  });

  it("persists all MiraLink preferences", async () => {
    const preferences = {
      ...defaultMiraLinkPreferences,
      provider_mode: "pointer" as const,
      high_contrast: true,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: "miralink-default",
          preferences,
          quick_phrases: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await updateProfile(preferences);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/profiles/miralink-default"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify(preferences),
      }),
    );
  });
});
