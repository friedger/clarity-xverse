import { tx } from "@hirosystems/clarinet-sdk";
import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { allowContractCaller, getCycleLength } from "./client/pox-4-client.js";
import {
  POX_POOL_SELF_SERVICE_CONTRACT_NAME,
  delegateStx,
  fpDelegationAllowContractCaller,
  poxPoolSelfServiceContract,
} from "./client/pox-pool-self-service-client.ts";
import { PoxErrors, poxAddrFP } from "./constants.ts";
import { expectOkLockingResult, expectPartialStackedByCycle } from "./utils.ts";
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;

const { CYCLE } = getCycleLength();

describe(POX_POOL_SELF_SERVICE_CONTRACT_NAME + " allowance", () => {
  it("Ensure that user can't delegate without allowance", () => {
    // try without any allowance
    let block = simnet.mineBlock([delegateStx(20_000_000_000_000, wallet_1)]);

    // check delegation calls
    expect(block[0].result).toBeErr(
      Cl.uint(PoxErrors.StackingPermissionDenied * 1_000)
    );
  });

  it("Ensure that user can only delegate from a contract with two allowances", () => {
    const helperDelegateStx = (amountUstx: number, user: string) => {
      return tx.callPublicFn(
        "helper",
        "delegate-stx",
        [Cl.uint(amountUstx)],
        user
      );
    };

    const helperContract = deployer + ".helper";

    // try without any allowance
    let block = simnet.mineBlock([helperDelegateStx(20_000_000_000, wallet_1)]);
    expect(block[0].result).toBeErr(Cl.uint(609));

    // try with pox delegation allowance only
    block = simnet.mineBlock([
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      helperDelegateStx(20_000_000_000_000, wallet_1),
    ]);

    expect(block[0].result).toBeOk(Cl.bool(true));
    expect(block[1].result).toBeErr(Cl.uint(609));

    // delegate-stx with all allowances
    block = simnet.mineBlock([
      fpDelegationAllowContractCaller(helperContract, undefined, wallet_1),
      helperDelegateStx(20_000_000_000_000, wallet_1),
    ]);
    expect(block[0].result).toBeOk(Cl.bool(true));
    expectOkLockingResult(block[1], {
      lockAmount: 20_000_000_000_000 - 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2 * CYCLE,
    });
    expectPartialStackedByCycle(poxAddrFP, 1, 19_999_999_000_000, deployer);
  });
});
