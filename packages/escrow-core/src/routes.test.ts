import { describe, expect, it } from "vitest";
import { getEscrowRoutePolicy } from "./routes";

describe("getEscrowRoutePolicy", () => {
  it("buyer_confirms_release requires buyer + intermediary and targets intermediary", () => {
    const policy = getEscrowRoutePolicy("buyer_confirms_release");

    expect(policy.requiredSigners).toEqual(["buyer", "intermediary"]);
    expect(policy.outputTarget).toBe("intermediary");
  });

  it("voluntary_refund requires buyer + intermediary and targets buyer", () => {
    const policy = getEscrowRoutePolicy("voluntary_refund");

    expect(policy.requiredSigners).toEqual(["buyer", "intermediary"]);
    expect(policy.outputTarget).toBe("buyer");
  });

  it("arbitrator_refund_to_buyer requires arbitrator + buyer and targets buyer", () => {
    const policy = getEscrowRoutePolicy("arbitrator_refund_to_buyer");

    expect(policy.requiredSigners).toEqual(["arbitrator", "buyer"]);
    expect(policy.outputTarget).toBe("buyer");
  });

  it("moderator_release_to_intermediary requires moderator + intermediary and targets intermediary", () => {
    const policy = getEscrowRoutePolicy("moderator_release_to_intermediary");

    expect(policy.requiredSigners).toEqual(["moderator", "intermediary"]);
    expect(policy.outputTarget).toBe("intermediary");
  });
});
