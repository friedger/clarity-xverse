import { describe, expect, it } from "vitest";
import { allowContractCaller, getCycleLength } from "./client/pox-4-client.js";
import {
  POX_POOL_SELF_SERVICE_CONTRACT_NAME,
  delegateStackStx,
  delegateStx,
  poxPoolsSelfServiceContract,
} from "./client/pox-pool-self-service-client.ts";
import { poxAddrFP } from "./constants.ts";
import {
  expectPartialStackedByCycle,
  expectTotalStackedByCycle,
} from "./utils.ts";
import { expectOkTrue } from "@stacks/clarunit/src/parser/test-helpers.ts";
import { Cl } from "@stacks/transactions";
import { ParsedTransactionResult } from "@hirosystems/clarinet-sdk";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const wallet_2 = accounts.get("wallet_2")!;

const expectOkDelegateResult = (
  result: ParsedTransactionResult,
  expectedResult: {
    lockAmount: number;
    stacker: string;
    unlockBurnHeight: number;
  }
) => {
  expect(result.result).toBeOk(
    Cl.tuple({
      "lock-amount": Cl.uint(expectedResult.lockAmount),
      stacker: Cl.principal(expectedResult.stacker),
      "unlock-burn-height": Cl.uint(expectedResult.unlockBurnHeight),
    })
  );
};
describe(POX_POOL_SELF_SERVICE_CONTRACT_NAME, () => {
  it("Ensure that users can delegate", () => {
    let block = simnet.mineBlock([
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_1),
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_2),

      delegateStx(20_000_000_000_100, wallet_1),
      delegateStx(2_100_000, wallet_2),
    ]);

    // check allow contract caller
    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);

    expectOkDelegateResult(block[2], {
      lockAmount: 19_999_999_000_100,
      stacker: wallet_1,
      unlockBurnHeight: 2100,
    });
    expectOkDelegateResult(block[3], {
      lockAmount: 1_100_000,
      stacker: wallet_2,
      unlockBurnHeight: 2100,
    });

    // commit did not yet happen
    // commit needs to be called by pool operator with signer key
    expectPartialStackedByCycle(poxAddrFP, 1, 20_000_000_100_100, deployer);
    expectTotalStackedByCycle(1, 0, undefined, deployer);
  });

  it("See that in simnet user can't increase amount for next cycle", () => {
    const { CYCLE } = getCycleLength();
    // current cycle is cycle 0

    // delegate 2 stx for cycle 1
    let block = simnet.mineBlock([
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_1),
      delegateStx(2_000_000, wallet_1),
    ]);

    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkDelegateResult(block[1], {
      lockAmount: 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2100,
    });
    console.log(block[1].events);

    expectPartialStackedByCycle(poxAddrFP, 1, 1_000_000, deployer);
    expectTotalStackedByCycle(1, 0, undefined, deployer);

    simnet.mineEmptyBlocks(CYCLE);

    // increase delegation to 3 stx for cycle 2
    block = simnet.mineBlock([delegateStx(3_000_000, wallet_1)]);
    expectOkDelegateResult(block[0], {
      lockAmount: 2_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 3150,
    });
  });

  it("See that in simnet user can extend for next cycle for any user", () => {
    const { CYCLE, HALF_CYCLE } = getCycleLength();

    let block = simnet.mineBlock([
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_1),
      delegateStx(2_000_000, wallet_1),
    ]);

    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkDelegateResult(block[1], {
      lockAmount: 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2100,
    });
    expectPartialStackedByCycle(poxAddrFP, 1, 1_000_000, deployer);
    expectPartialStackedByCycle(poxAddrFP, 2, undefined, deployer);

    // advance to middle of next cycle
    simnet.mineEmptyBlocks(CYCLE + HALF_CYCLE - 3);

    // try to extend to cycle 2 early
    block = simnet.mineBlock([delegateStackStx(wallet_1, wallet_2)]);
    expect(block.length).toBe(1);
    expect(block[0].result).toBeErr(Cl.uint(500)); // too early
    expect(simnet.blockHeight).toBe(CYCLE + HALF_CYCLE + 2);

    // extend to cycle 2
    block = simnet.mineBlock([delegateStackStx(wallet_1, wallet_2)]);
    expectPartialStackedByCycle(poxAddrFP, 2, 1_000_000, deployer);
    expectOkDelegateResult(block[0], {
      lockAmount: 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 3150,
    });

    expectPartialStackedByCycle(poxAddrFP, 2, 1_000_000, deployer);
  });
});
