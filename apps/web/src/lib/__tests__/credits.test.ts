jest.mock("../supabase", () => ({ supabaseAdmin: { from: jest.fn() } }));

import { deductCredit, getCredits, DAILY_APP_CREDITS } from "../credits";
import { supabaseAdmin } from "../supabase";

const mockQuery = {
  select: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
};
const mockFrom = supabaseAdmin.from as jest.Mock;

function setDate(value: string) {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(value));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue(mockQuery);
  mockQuery.select.mockReturnValue(mockQuery);
  mockQuery.eq.mockReturnValue(mockQuery);
  mockQuery.update.mockReturnValue(mockQuery);
  mockQuery.insert.mockResolvedValue({ data: null, error: null });
});

afterEach(() => jest.useRealTimers());

describe("Pro App Credits", () => {
  it("initialises a new Pro user with 50 daily App Credits", async () => {
    setDate("2024-01-15T12:00:00Z");
    mockQuery.single.mockResolvedValue({ data: null, error: null });

    await expect(getCredits("user-1")).resolves.toBe(DAILY_APP_CREDITS);
    expect(mockQuery.insert).toHaveBeenCalledWith({ user_id: "user-1", current_balance: 50, last_reset_date: "2024-01-15" });
  });

  it("keeps the balance within the same UTC day", async () => {
    setDate("2024-01-15T12:00:00Z");
    mockQuery.single.mockResolvedValue({ data: { user_id: "user-1", current_balance: 24, last_reset_date: "2024-01-15" }, error: null });

    await expect(getCredits("user-1")).resolves.toBe(24);
    expect(mockQuery.update).not.toHaveBeenCalled();
  });

  it("resets the balance to 50 when a new UTC day starts", async () => {
    setDate("2024-01-15T00:01:00Z");
    mockQuery.single.mockResolvedValue({ data: { user_id: "user-1", current_balance: 3, last_reset_date: "2024-01-14" }, error: null });

    await expect(getCredits("user-1")).resolves.toBe(50);
    expect(mockQuery.update).toHaveBeenCalledWith({ current_balance: 50, last_reset_date: "2024-01-15" });
  });

  it("deducts one App Credit when a balance is available", async () => {
    setDate("2024-01-15T12:00:00Z");
    mockQuery.single.mockResolvedValue({ data: { user_id: "user-1", current_balance: 2, last_reset_date: "2024-01-15" }, error: null });

    await expect(deductCredit("user-1")).resolves.toBe(true);
    expect(mockQuery.update).toHaveBeenLastCalledWith({ current_balance: 1 });
  });
});
