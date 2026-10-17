export type AccountCreditBalances = { total: number; grants: number; purchased: number; legacy: number };

export default function AccountCreditSummary({ credits, isDev }: { credits: AccountCreditBalances; isDev: boolean }) {
  return <section aria-label="Shared account credits" className="space-y-3 text-xs">
    <p className="text-lg font-semibold">Shared account credits: {isDev ? "Unlimited" : credits.total}</p>
    {!isDev && <p>Grants: {credits.grants} · Purchased: {credits.purchased} · Imported legacy: {credits.legacy}</p>}
    <p>App and API use this same balance, not two wallets. Eligible grants are spent first; Pro grants expire at the admin-recorded period end. Purchased credits carry over.</p>
    <p>Checkout and credit purchases are unavailable. Creating API keys does not grant more credits.</p>
  </section>;
}
