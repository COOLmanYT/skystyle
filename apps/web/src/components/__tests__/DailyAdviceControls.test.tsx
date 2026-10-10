import type { ReactElement } from "react";
import DailyAdviceControls from "../DailyAdviceControls";
import { DEFAULT_COMFORT } from "@/lib/comfort";

// Exercise the component's async load and real event handlers without a DOM.
const mockStates: unknown[] = [];
const mockEffects: Array<() => void> = [];
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useState: (initial: unknown) => {
    const index = mockStates.push(initial) - 1;
    return [initial, (value: unknown) => { mockStates[index] = typeof value === "function" ? value(mockStates[index]) : value; }];
  },
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: (effect: () => void) => { mockEffects.push(effect); },
}));
function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...elements(element.props.children)];
}
describe("comfort preference loading preserves edits", () => {
  beforeEach(() => {
    mockStates.length = 0; mockEffects.length = 0;
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
  });
  afterEach(() => { jest.restoreAllMocks(); });
  it.each(["temperature", "reset", "save"])("does not overwrite %s changes with a late cloud response", async action => {
    let complete!: (value: Response) => void;
    globalThis.fetch = jest.fn((_url: RequestInfo | URL, options?: RequestInit) => options?.method === "PATCH"
      ? Promise.resolve({ ok: true } as Response)
      : new Promise<Response>(resolve => { complete = resolve; })) as typeof fetch;
    const tree = DailyAdviceControls({ userId: "fixture", onChange: jest.fn() });
    mockEffects[0]();
    const nodes = elements(tree);
    if (action === "temperature") {
      const select = nodes.find(node => node.type === "select")!;
      (select.props.onChange as (event: unknown) => void)({ target: { value: "cold" } });
    } else {
      const button = nodes.find(node => node.type === "button" && node.props.children === (action === "reset" ? "Reset comfort" : "Save preferences"))!;
      (button.props.onClick as () => void)();
    }
    complete({ ok: true, json: async () => ({ comfort_preferences: { ...DEFAULT_COMFORT, temperature: "warm" } }) } as Response);
    await new Promise(resolve => setImmediate(resolve));
    expect(mockStates[0]).toEqual({ ...DEFAULT_COMFORT, temperature: action === "temperature" ? "cold" : "neutral" });
  });
});
