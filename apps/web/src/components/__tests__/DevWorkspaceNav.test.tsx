import { renderToStaticMarkup } from "react-dom/server";
import DevWorkspaceNav from "../DevWorkspaceNav";
import { usePathname } from "next/navigation";
jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
describe("Dev Center route navigation", () => {
  it("keeps a nested user profile in the Users workspace", () => {
    (usePathname as jest.Mock).mockReturnValue("/dev/operations/users/account-id");
    const markup = renderToStaticMarkup(<DevWorkspaceNav />);
    expect(markup).toMatch(/<a(?=[^>]*href="\/dev\/operations\/users")(?=[^>]*aria-current="page")[^>]*>/);
    expect(markup).not.toMatch(/<a(?=[^>]*href="\/dev\/operations")(?=[^>]*aria-current="page")[^>]*>/);
    expect(markup).toContain("Navigate · Users");
  });
  it("offers addressable support and monitoring destinations on mobile", () => {
    (usePathname as jest.Mock).mockReturnValue("/dev/health");
    const markup = renderToStaticMarkup(<DevWorkspaceNav />);
    for (const href of ["/dev/triage", "/dev/chat", "/dev/operations/feedback", "/dev/operations/api-activity", "/dashboard"]) expect(markup).toContain(`href="${href}"`);
    expect(markup).toMatch(/<a(?=[^>]*href="\/dev\/health")(?=[^>]*aria-current="page")[^>]*>/);
    expect(markup).toContain("Navigate · Service health");
  });
});
