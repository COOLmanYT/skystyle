export default function Loading() {
  return (
    <div className="fixed left-0 top-0 z-[100] h-1 w-full" aria-hidden="true">
      <div className="h-full w-full animate-pulse" style={{ background: "var(--accent)" }} />
    </div>
  );
}
