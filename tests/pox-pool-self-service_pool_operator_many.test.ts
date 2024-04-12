import { expectOkTrue } from "@stacks/clarunit/src/parser/test-helpers.ts";
import { Cl, ListCV, ResponseOkCV } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import {
  allowContractCaller,
  asyncExpectCurrentCycle,
  getCycleLength,
  delegateStx as poxDelegateStx,
} from "./client/pox-4-client.js";
import {
  POX_POOL_SELF_SERVICE_CONTRACT_NAME,
  delegateStackStx,
  delegateStackStxMany,
  delegateStx,
  poxPoolSelfServiceContract,
} from "./client/pox-pool-self-service-client.ts";
import { FpErrors, poxAddrFP } from "./constants.ts";
import {
  expectOkLockingResult,
  expectPartialStackedByCycle,
  expectTotalStackedByCycle,
} from "./utils.ts";
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const wallet_2 = accounts.get("wallet_2")!;
const { CYCLE, HALF_CYCLE } = getCycleLength();

describe(POX_POOL_SELF_SERVICE_CONTRACT_NAME + " pool operator many", () => {
  it("Ensure users can't lock when already stacking", () => {
    simnet.mineEmptyBlocks(2 * CYCLE);

    let block = simnet.mineBlock([
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_2),

      delegateStx(20_000_000_000_000, wallet_1),
      delegateStx(2_000_000, wallet_2),
    ]);

    // check allow contract caller
    expect(block[0].result).toBeOk(Cl.bool(true));
    expect(block[1].result).toBeOk(Cl.bool(true));
    // check delegation calls
    expectOkLockingResult(block[2].result, {
      lockAmount: 20_000_000_000_000 - 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 4 * CYCLE,
    });
    expectOkLockingResult(block[3].result, {
      lockAmount: 2_000_000 - 1_000_000,
      stacker: wallet_2,
      unlockBurnHeight: 4 * CYCLE,
    });

    simnet.mineEmptyBlocks(HALF_CYCLE);

    block = simnet.mineBlock([
      delegateStackStxMany([wallet_1, wallet_2], deployer),
    ]);

    let lockingInfoList = (block[0].result as ResponseOkCV<ListCV>).value.list;
    expect(lockingInfoList[0]).toBeErr(Cl.uint(FpErrors.AlreadyStacking));
    expect(lockingInfoList[1]).toBeErr(Cl.uint(FpErrors.AlreadyStacking));
  });

  it("Ensure that user can lock for others who used pox", () => {
    simnet.mineEmptyBlocks(2 * CYCLE);

    let block = simnet.mineBlock([
      //no allow call for wallet_1
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_2),

      poxDelegateStx(20_000_000_000_000, poxPoolSelfServiceContract, wallet_1),
      delegateStx(2_000_000, wallet_2),
    ]);

    // check allow contract caller
    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    // check delegation calls
    expectOkTrue(block, "pox-4", "delegate-stx", 1);
    expectOkLockingResult(block[2].result, {
      lockAmount: 1_000_000,
      stacker: wallet_2,
      unlockBurnHeight: 4 * CYCLE,
    });

    simnet.mineEmptyBlocks(HALF_CYCLE - 2);

    block = simnet.mineBlock([
      delegateStackStxMany([wallet_1, wallet_2], deployer),
    ]);
    let lockingInfoList = (block[0].result as ResponseOkCV<ListCV>).value.list;
    expectOkLockingResult(lockingInfoList[0], {
      lockAmount: 20_000_000_000_000 - 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 4 * CYCLE,
    });

    expect(lockingInfoList[1]).toBeErr(Cl.uint(FpErrors.AlreadyStacking));
  });

  it("User can increase amount for next cycle", () => {
    simnet.mineEmptyBlocks(CYCLE);
    // current cycle is cycle 1
    asyncExpectCurrentCycle(1);

    // delegate 20 stx for cycle 2
    let block = simnet.mineBlock([
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_2),
      delegateStx(20_000_000, wallet_1),
      delegateStx(20_000_000, wallet_2),
    ]);

    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
    expectOkLockingResult(block[2].result, {
      lockAmount: 20_000_000 - 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 3 * CYCLE,
    });
    expectOkLockingResult(block[2].result, {
      lockAmount: 20_000_000 - 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 3 * CYCLE,
    });

    expectPartialStackedByCycle(poxAddrFP, 2, 38_000_000, deployer);
    expectTotalStackedByCycle(2, 0, undefined, deployer);

    simnet.mineEmptyBlocks(CYCLE + HALF_CYCLE);

    // lock for cycle 3
    block = simnet.mineBlock([
      delegateStackStxMany([wallet_1, wallet_2], deployer),
    ]);

    let lockingInfoList = (block[0].result as ResponseOkCV<ListCV>).value.list;
    expectOkLockingResult(lockingInfoList[0], {
      lockAmount: 20_000_000 - 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 4 * CYCLE,
    });

    expectOkLockingResult(lockingInfoList[1], {
      lockAmount: 20_000_000 - 1_000_000,
      stacker: wallet_2,
      unlockBurnHeight: 4 * CYCLE,
    });
  });

  it("Ensure user can extend for next cycle for any user", () => {
    let block = simnet.mineBlock([
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      delegateStx(2_000_000, wallet_1),
    ]);

    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkLockingResult(block[1].result, {
      lockAmount: 2_000_000 - 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2 * CYCLE,
    });

    expectPartialStackedByCycle(poxAddrFP, 1, 1_000_000, deployer);
    expectPartialStackedByCycle(poxAddrFP, 2, undefined, deployer);

    // advance to middle of next cycle
    simnet.mineEmptyBlocks(CYCLE + HALF_CYCLE - 3);
    // try to extend to cycle 3 early
    block = simnet.mineBlock([delegateStackStx(wallet_1, wallet_2)]);
    expect(simnet.blockHeight).toBe(CYCLE + HALF_CYCLE + 2);
    expect(block[0].result).toBeErr(Cl.uint(FpErrors.TooEarly));

    // extend to cycle 3
    block = simnet.mineBlock([delegateStackStx(wallet_1, wallet_2)]);
    expectOkLockingResult(block[0].result, {
      lockAmount: 2_000_000 - 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 3 * CYCLE,
    });

    expectPartialStackedByCycle(poxAddrFP, 2, 1_000_000, deployer);
  });
});
