import type { EscrowScriptDraft, EscrowTransactionDraft } from "./types";

export interface EscrowScriptBuilderAdapter {
  buildScript(draft: EscrowScriptDraft): Promise<EscrowScriptDraft>;
}

export interface EscrowTransactionBuilderAdapter {
  buildTransaction(
    draft: EscrowTransactionDraft
  ): Promise<EscrowTransactionDraft>;
}

export interface EscrowBroadcasterAdapter {
  broadcastTx(txHex: string): Promise<{ txid: string }>;
}

export interface EscrowChainWatcherAdapter {
  getTxConfirmations(txid: string): Promise<number>;
  getAddressBalanceXec(address: string): Promise<number>;
}
