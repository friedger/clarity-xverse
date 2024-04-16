import { expectOkTrue } from "@stacks/clarunit/src/parser/test-helpers.ts";
import { Cl, ClarityType, ListCV, ResponseOkCV } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { allowContractCaller } from "./client/pox-4-client.js";
import {
  POX4_POOLS,
  delegateStackStxSimple,
  delegateStx,
  poxPools1CycleContract,
} from "./client/pox-pools-1-cycle-client.ts";
import { btcAddrWallet1, btcAddrWallet2, poxAddrPool1 } from "./constants.ts";
import { expectOkLockingResult } from "./utils.ts";

const accounts = simnet.getAccounts();
let deployer = accounts.get("deployer")!;
let wallet_1 = accounts.get("wallet_1")!;
let wallet_2 = accounts.get("wallet_2")!;

describe(POX4_POOLS + " Simple flow", () => {
  it("Ensure that user can delegate and pool operator can lock stx without detailed amount", () => {
    let block = simnet.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, deployer),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_2),

      delegateStx(
        1_000_000,
        deployer,
        6300,
        undefined,
        btcAddrWallet1,
        wallet_1
      ),

      delegateStx(
        10_000_000_000_000,
        deployer,
        undefined,
        undefined,
        btcAddrWallet2,
        wallet_2
      ),

      delegateStackStxSimple([wallet_1, wallet_2], poxAddrPool1, 40, deployer),
    ]);

    // verify results for allow contract caller
    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 2);
    // verify results for delegate-stx calls
    expectOkTrue(block, "pox-4", "delegate-stx", 3);
    expectOkTrue(block, "pox-4", "delegate-stx", 4);

    // verify delegate-stack-stx call by pool operator
    expect(block[5].result).toHaveClarityType(ClarityType.ResponseOk);
    let lockingInfoList = (block[5].result as ResponseOkCV<ListCV>).value.list;
    expectOkLockingResult(lockingInfoList[0], {
      lockAmount: 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2100,
    });
    expectOkLockingResult(lockingInfoList[1], {
      lockAmount: 9_999_999_000_000,
      stacker: wallet_2,
      unlockBurnHeight: 2100,
    });
  });
});
