import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { auth } from "@/auth";
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/server", () => ({ NextResponse: { next: () => "allowed", redirect: (url: URL) => url.toString() } }));
function request(path: string) {
  const nextUrl = new URL(path, "https://skystyle.app");
  return { nextUrl: Object.assign(nextUrl, { clone: () => new URL(nextUrl) }) } as unknown as NextRequest;
}
describe("public product navigation", () => {
  it.each(["/pricing", "/how-it-works", "/api/plans", "/api/auth/session"])("permits anonymous read access to %s", async path => {
    expect(await proxy(request(path))).toBe("allowed");
    expect(auth).not.toHaveBeenCalled();
  });
  it.each(["/dashboard", "/closet", "/api/wardrobe", "/api/plans-private"])("still protects %s", async path => {
    (auth as jest.Mock).mockResolvedValue(null);
    expect(await proxy(request(path))).toBe("https://skystyle.app/login");
    expect(auth).toHaveBeenCalledTimes(1);
  });
});
