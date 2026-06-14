import { TonalliWalletConnectAuth } from "@/components/auth/TonalliWalletConnectAuth";

export default function TonalliWalletAuthPage() {
  return (
    <main
      style={{
        color: "#17211c",
        display: "grid",
        gap: "1.25rem",
        margin: "0 auto",
        maxWidth: "64rem",
        padding: "2rem",
      }}
    >
      <header style={{ display: "grid", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "2rem", lineHeight: 1.15, margin: 0 }}>
          Tonalli WalletConnect Auth Spike
        </h1>
        <p
          style={{
            background: "#fff8d7",
            border: "1px solid #d9bb55",
            borderRadius: "6px",
            margin: 0,
            padding: "0.75rem",
          }}
        >
          Development spike. Mock connector uses dev-valid-signature and
          requires TONALLI_AUTH_DEV_BYPASS=true.
        </p>
      </header>
      <TonalliWalletConnectAuth />
    </main>
  );
}
