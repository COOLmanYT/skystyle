import { selectLatestLoginPopup } from "../changelog-popup";

describe("login changelog popup", () => {
  const entries = [
    { version: "6.0.0", showOnNextLogin: false },
    { version: "5.3.0", showOnNextLogin: true },
  ];

  it("never falls back to an older flagged post", () => {
    expect(selectLatestLoginPopup(entries, [])).toBeNull();
  });

  it("shows the latest post once only when it is flagged", () => {
    const latest = { version: "6.0.0", showOnNextLogin: true };
    expect(selectLatestLoginPopup([latest, entries[1]], [])).toBe(latest);
    expect(selectLatestLoginPopup([latest, entries[1]], ["6.0.0"])).toBeNull();
  });

  it("does nothing when the changelog is empty", () => {
    expect(selectLatestLoginPopup([], [])).toBeNull();
  });
});
