export async function verifyTonalliMessage(
  message: string,
  signature: string,
  address: string,
): Promise<boolean> {
  void message;
  void address;

  if (
    process.env.TONALLI_AUTH_DEV_BYPASS === "true" &&
    signature === "dev-valid-signature"
  ) {
    return true;
  }

  // TODO: integrate real Tonalli wallet signature verification from tonalli-core.
  return false;
}
