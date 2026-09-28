import { getOnboardingState } from "../onboarding";
import { supabaseAdmin } from "../supabase";

jest.mock("../supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));

describe("durable V6 onboarding state", () => {
  const read = jest.fn();
  const eq = jest.fn(() => ({ maybeSingle: read }));
  beforeEach(() => {
    jest.mocked(supabaseAdmin.from).mockReturnValue({ select: () => ({ eq }) } as never);
  });
  it("does not inherit a browser marker for a new account", async () => {
    read.mockResolvedValue({ data: null, error: null });
    expect(await getOnboardingState("new-user")).toEqual({ complete: false, experienceMode: null, persistenceAvailable: true });
    expect(eq).toHaveBeenCalledWith("user_id", "new-user");
  });
  it("recognizes a returning account and its advanced choice", async () => {
    read.mockResolvedValue({ data: { onboarding_completed_at: "2026-09-28T00:00:00Z", experience_mode: "advanced" }, error: null });
    expect(await getOnboardingState("returning-user")).toEqual({ complete: true, experienceMode: "advanced", persistenceAvailable: true });
  });
  it("allows browser fallback on a database error", async () => {
    read.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    expect(await getOnboardingState("user")).toEqual({ complete: false, experienceMode: null, persistenceAvailable: false });
  });
  it("allows fallback instead of crashing on a network exception", async () => {
    read.mockRejectedValue(new Error("Network offline"));
    expect(await getOnboardingState("user")).toEqual({ complete: false, experienceMode: null, persistenceAvailable: false });
  });
});
