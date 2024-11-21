import { tx } from "@hirosystems/clarinet-sdk";
import { Cl, ClarityValue } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { getCycleLength } from "./client/pox-4-client.js";

const accounts = simnet.getAccounts();
let deployer = accounts.get("deployer")!;
let wallet_1 = accounts.get("wallet_1")!;
const { HALF_CYCLE } = getCycleLength();

describe("fp-auto-extend", () => {
  it("Ensure that auto-extend-job does run with at least 1 user after half cycle passed", () => {
    simnet.mineEmptyBurnBlocks(HALF_CYCLE);

    let block = simnet.mineBlock([
      tx.callPublicFn(
        "fp-auto-extend",
        "set-users",
        [Cl.list([Cl.principal(wallet_1)])] as ClarityValue[],
        deployer
      ),
      tx.callPublicFn("fp-auto-extend", "run-job", [], deployer),
    ]);

    // verify results for run-job
    expect(block[0].result).toBeOk(Cl.bool(true));
    expect(block[1].result).toBeOk(Cl.bool(true));
  });

  it("Ensure that auto-extend-job does not run too early", () => {
    simnet.mineEmptyBurnBlock();

    let block = simnet.mineBlock([
      tx.callPublicFn(
        "fp-auto-extend",
        "set-users",
        [Cl.list([Cl.principal(wallet_1)])],
        deployer
      ),
      tx.callPublicFn("fp-auto-extend", "run-job", [], deployer),
    ]);

    // verify results for run-job
    expect(block[0].result).toBeOk(Cl.bool(true));
    expect(block[1].result).toBeOk(Cl.bool(false));
  });

  it("Ensure that auto-extend-job does not run without at least 1 user", () => {
    simnet.mineEmptyBurnBlocks(HALF_CYCLE);

    let block = simnet.mineBlock([
      tx.callPublicFn("fp-auto-extend", "run-job", [], deployer),
    ]);

    // verify results for run-job
    expect(block[0].result).toBeOk(Cl.bool(false));
  });
});
