import { expectOkTrue } from "@stacks/clarunit/src/parser/test-helpers.ts";
import { Cl, ClarityType, ListCV, ResponseOkCV } from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";
import { allowContractCaller, getCycleLength } from "./client/pox-4-client.js";
import {
  POX4_SELF_SERVICE_CONTRACT_NAME,
  delegateStackStxMany,
  delegateStx,
  poxPoolSelfServiceContract,
  setActive,
  setPoolPoxAddress,
  setPoxAddressActive,
  setRewardAdmin,
  setStxBuffer,
} from "./client/pox4-self-service-client.ts";
import { FpErrors, btcAddrWallet1, poxAddrFP } from "./constants.ts";
import { expectOkLockingResult, expectPartialStackedByCycle } from "./utils.ts";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const { CYCLE } = getCycleLength();

describe(POX4_SELF_SERVICE_CONTRACT_NAME + " admin", () => {
  beforeEach(() => {
    let block = simnet.mineBlock([
      setPoxAddressActive(
        "bc1qs0kkdpsrzh3ngqgth7mkavlwlzr7lms2zv3wxe",
        deployer
      ),
    ]);
    expectOkTrue(
      block,
      POX4_SELF_SERVICE_CONTRACT_NAME,
      "set-pox-address-active"
    );
  });

  it("Ensure that admin can deactivate contract", () => {
    const { HALF_CYCLE, CYCLE } = getCycleLength();

    let block = simnet.mineBlock([
      setActive(false, deployer),
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      delegateStx(20_000_000_000_000, wallet_1),
      delegateStackStxMany([wallet_1], deployer),
    ]);

    expectOkTrue(block, POX4_SELF_SERVICE_CONTRACT_NAME, "set-active", 0);
    // check allow contract caller
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
    expect(block[2].result).toBeErr(Cl.uint(FpErrors.PoxAddressDeactivated));
    expect(block[3].result).toBeErr(Cl.uint(FpErrors.TooEarly));

    simnet.mineEmptyBlocks(HALF_CYCLE);

    block = simnet.mineBlock([delegateStackStxMany([wallet_1], deployer)]);
    let lockingInfoList = (block[0].result as ResponseOkCV<ListCV>).value.list;
    expect(lockingInfoList[0]).toBeErr(Cl.uint(FpErrors.PoxAddressDeactivated));
  });

  it("Ensure that non-admin cannot use admin functions", () => {
    let block = simnet.mineBlock([
      setActive(false, wallet_1),
      setRewardAdmin(wallet_1, true, wallet_1),
      setStxBuffer(1_000_000_000_000, wallet_1),
      setPoolPoxAddress(btcAddrWallet1, wallet_1),
    ]);

    block.map((r: any) =>
      expect(r.result).toBeErr(Cl.uint(FpErrors.Unauthorized))
    );
  });

  it("Ensure that admin can set stx buffer", () => {
    let block = simnet.mineBlock([
      setStxBuffer(1_000, deployer),
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      delegateStx(10_000_000, wallet_1),
    ]);
    expectOkTrue(block, "transfer", "stx", 0);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
    expectOkLockingResult(block[2].result, {
      lockAmount: 9_999_000,
      stacker: wallet_1,
      unlockBurnHeight: 2 * CYCLE,
    });
    expectPartialStackedByCycle(poxAddrFP, 1, 9_999_000, deployer);
  });

  it("Ensure that admin can set pool address", () => {
    let block = simnet.mineBlock([
      setPoolPoxAddress(btcAddrWallet1, deployer),
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      delegateStx(10_000_000, wallet_1),
    ]);
    expectOkTrue(block, "transfer", "stx", 0);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
    expectOkLockingResult(block[2].result, {
      lockAmount: 9_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2 * CYCLE,
    });
    expectPartialStackedByCycle(btcAddrWallet1, 1, 9_000_000, deployer);
  });

  it("Ensure that there is always an admin", () => {
    let block = simnet.mineBlock([
      setRewardAdmin(deployer, false, deployer),
      setRewardAdmin(deployer, false, wallet_1),
      setRewardAdmin(wallet_1, true, deployer),
      setRewardAdmin(deployer, false, deployer),
      setRewardAdmin(deployer, false, wallet_1),
    ]);

    expect(block[0].result).toBeErr(Cl.uint(FpErrors.Forbidden));
    expect(block[1].result).toBeErr(Cl.uint(FpErrors.Unauthorized));
    expect(block[2].result).toBeOk(Cl.bool(true));
    expect(block[3].result).toBeErr(Cl.uint(FpErrors.Forbidden));
    expect(block[4].result).toBeOk(Cl.bool(true));
  });
});
