"use client";

import { useMemo, useState } from "react";

import { createTonalliWalletConnector } from "./walletconnect-tonalli-connector";

interface TonalliAuthChallenge {
  domain: string;
  address: string;
  alias?: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  purpose: "authentication";
  network: "eCash";
  version: "TonalliAuth-v1";
}

interface ChallengeResponse {
  challenge: TonalliAuthChallenge;
  message: string;
}

interface VerifyResponse {
  valid: boolean;
  authenticated?: boolean;
  address?: string;
  alias?: string;
  reason?: string;
}

type Step = "challenge" | "connect" | "sign" | "verify";
type AuthStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "signing"
  | "verifying"
  | "verified"
  | "failed";

const defaultAddress = "ecash:qzdq0q65fwnt94rlcph5kllj0xcry6e0v58zrgp7a3";

export function TonalliWalletConnectAuth() {
  const connector = useMemo(() => createTonalliWalletConnector(), []);
  const [address, setAddress] = useState(defaultAddress);
  const [alias, setAlias] = useState("");
  const [challengeResponse, setChallengeResponse] =
    useState<ChallengeResponse | null>(null);
  const [signature, setSignature] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState("");
  const [loadingStep, setLoadingStep] = useState<Step | null>(null);
  const [status, setStatus] = useState<AuthStatus>("disconnected");

  const message = challengeResponse?.message ?? "";

  async function connectWallet() {
    setError("");
    setLoadingStep("connect");
    setStatus("connecting");

    try {
      await connector.connect();
      setStatus("connected");
    } catch (caught) {
      setStatus("failed");
      setError(errorMessage(caught));
    } finally {
      setLoadingStep(null);
    }
  }

  async function createChallenge() {
    setError("");
    setSignature("");
    setVerifyResult(null);
    setChallengeResponse(null);
    setLoadingStep("challenge");

    try {
      const response = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          alias: alias.trim().length === 0 ? undefined : alias,
        }),
      });
      const body = (await response.json()) as unknown;

      if (!response.ok || !isChallengeResponse(body)) {
        throw new Error(readError(body, "Failed to create challenge"));
      }

      setChallengeResponse(body);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoadingStep(null);
    }
  }

  async function signChallenge() {
    setError("");
    setSignature("");
    setVerifyResult(null);

    if (challengeResponse === null) {
      setError("Create a challenge before signing");
      return;
    }

    setLoadingStep("sign");
    setStatus("signing");

    try {
      const nextSignature = await connector.signMessage({
        address,
        message: challengeResponse.message,
      });
      setSignature(nextSignature);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoadingStep(null);
    }
  }

  async function verifySignature() {
    setError("");
    setVerifyResult(null);

    if (challengeResponse === null) {
      setError("Create a challenge before verifying");
      return;
    }

    if (signature.trim().length === 0) {
      setError("Sign the challenge before verifying");
      return;
    }

    setLoadingStep("verify");
    setStatus("verifying");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce: challengeResponse.challenge.nonce,
          signature,
        }),
      });
      const body = (await response.json()) as unknown;

      if (!isVerifyResponse(body)) {
        throw new Error(readError(body, "Unexpected verify response"));
      }

      setVerifyResult(body);

      if (!response.ok) {
        setStatus("failed");
        setError(body.reason ?? "Signature verification failed");
      } else if (body.authenticated === true || body.valid) {
        setStatus("verified");
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoadingStep(null);
    }
  }

  return (
    <section style={styles.shell}>
      <div style={styles.controls}>
        <label style={styles.label}>
          Address
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          Alias
          <input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="optional"
            style={styles.input}
          />
        </label>
        <p style={styles.status}>Status: {status}</p>
        <div style={styles.actions}>
          <button
            type="button"
            onClick={connectWallet}
            disabled={loadingStep !== null || status === "connected" || status === "verified"}
            style={styles.button}
          >
            {loadingStep === "connect" ? "Connecting..." : "Connect wallet"}
          </button>
          <button
            type="button"
            onClick={createChallenge}
            disabled={loadingStep !== null}
            style={styles.button}
          >
            {loadingStep === "challenge" ? "Creating..." : "Create challenge"}
          </button>
          <button
            type="button"
            onClick={signChallenge}
            disabled={loadingStep !== null || challengeResponse === null}
            style={styles.button}
          >
            {loadingStep === "sign" ? "Signing..." : "Sign message"}
          </button>
          <button
            type="button"
            onClick={verifySignature}
            disabled={
              loadingStep !== null ||
              challengeResponse === null ||
              signature.length === 0
            }
            style={styles.button}
          >
            {loadingStep === "verify" ? "Verifying..." : "Verify"}
          </button>
        </div>
      </div>

      {error.length > 0 ? <p style={styles.error}>{error}</p> : null}

      <OutputBlock
        title="Challenge"
        value={
          challengeResponse === null
            ? "No challenge yet"
            : JSON.stringify(challengeResponse.challenge, null, 2)
        }
      />
      <OutputBlock title="Message" value={message || "No message yet"} />
      <OutputBlock title="Signature" value={signature || "No signature yet"} />
      <OutputBlock
        title="Verification"
        value={
          verifyResult === null
            ? "No verification yet"
            : JSON.stringify(verifyResult, null, 2)
        }
      />
    </section>
  );
}

function OutputBlock(props: { title: string; value: string }) {
  return (
    <section style={styles.outputSection}>
      <h2 style={styles.outputTitle}>{props.title}</h2>
      <pre style={styles.pre}>{props.value}</pre>
    </section>
  );
}

function isChallengeResponse(value: unknown): value is ChallengeResponse {
  if (!isRecord(value) || typeof value.message !== "string") {
    return false;
  }

  const challenge = value.challenge;

  return (
    isRecord(challenge) &&
    typeof challenge.domain === "string" &&
    typeof challenge.address === "string" &&
    (challenge.alias === undefined || typeof challenge.alias === "string") &&
    typeof challenge.nonce === "string" &&
    typeof challenge.issuedAt === "string" &&
    typeof challenge.expirationTime === "string" &&
    challenge.purpose === "authentication" &&
    challenge.network === "eCash" &&
    challenge.version === "TonalliAuth-v1"
  );
}

function isVerifyResponse(value: unknown): value is VerifyResponse {
  return (
    isRecord(value) &&
    typeof value.valid === "boolean" &&
    (value.authenticated === undefined || typeof value.authenticated === "boolean") &&
    (value.address === undefined || typeof value.address === "string") &&
    (value.alias === undefined || typeof value.alias === "string") &&
    (value.reason === undefined || typeof value.reason === "string")
  );
}

function readError(value: unknown, fallback: string): string {
  if (isRecord(value)) {
    if (typeof value.error === "string") {
      return value.error;
    }

    if (typeof value.reason === "string") {
      return value.reason;
    }
  }

  return fallback;
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Unexpected auth error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const styles = {
  shell: {
    display: "grid",
    gap: "1rem",
  },
  controls: {
    display: "grid",
    gap: "0.75rem",
    maxWidth: "48rem",
  },
  label: {
    display: "grid",
    gap: "0.35rem",
    fontWeight: 600,
  },
  input: {
    border: "1px solid #b8c0cc",
    borderRadius: "6px",
    font: "inherit",
    padding: "0.65rem 0.75rem",
  },
  status: {
    fontWeight: 700,
    margin: 0,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  button: {
    background: "#143d2c",
    border: "1px solid #143d2c",
    borderRadius: "6px",
    color: "#ffffff",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 700,
    minHeight: "2.5rem",
    padding: "0.55rem 0.85rem",
  },
  error: {
    background: "#fff2f2",
    border: "1px solid #e49a9a",
    borderRadius: "6px",
    color: "#8a1f1f",
    margin: 0,
    padding: "0.75rem",
  },
  outputSection: {
    display: "grid",
    gap: "0.35rem",
  },
  outputTitle: {
    fontSize: "1rem",
    margin: 0,
  },
  pre: {
    background: "#101820",
    borderRadius: "6px",
    color: "#f6f8fa",
    margin: 0,
    overflowX: "auto",
    padding: "0.85rem",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
} satisfies Record<string, React.CSSProperties>;
