import { tx } from "@hirosystems/clarinet-sdk";
import { expectOkTrue } from "@stacks/clarunit/src/parser/test-helpers.ts";
import { hexToBytes } from "@stacks/common";
import { StacksTestnet } from "@stacks/network";
import {
  Pox4SignatureTopic,
  poxAddressToBtcAddress,
  signPox4SignatureHash,
} from "@stacks/stacking";
import {
  Cl,
  ListCV,
  ResponseOkCV,
  createStacksPrivateKey,
  pubKeyfromPrivKey,
  publicKeyToString,
} from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import {
  allowContractCaller,
  getCycleLength,
  revokeDelegateStx,
  stackAggregationCommitIndexed,
} from "./client/pox-4-client.js";
import {
  POX4_POOLS,
  delegateStackStx,
  delegateStx,
  expectOkStatus,
  getStatus,
  getTotal,
  pox4PoolsContract,
} from "./client/pox4-pools-client.ts";
import {
  Errors,
  PoxErrors,
  btcAddrWallet1,
  btcAddrWallet2,
  poxAddrPool1,
} from "./constants.ts";
import { expectOkLockingResult } from "./utils.ts";

let accounts = simnet.getAccounts();
let deployer = accounts.get("deployer")!;
let wallet_1 = accounts.get("wallet_1")!;
let wallet_2 = accounts.get("wallet_2")!;
let faucet = accounts.get("faucet")!;

describe(POX4_POOLS + " Flow", () => {
  it("Ensure that user can delegate and pool operator can lock stx and aggregate commit", () => {
    const { CYCLE } = getCycleLength();

    let block = simnet.mineBlock([
      allowContractCaller(pox4PoolsContract, undefined, deployer),
      allowContractCaller(pox4PoolsContract, undefined, wallet_1),
      allowContractCaller(pox4PoolsContract, undefined, wallet_2),

      delegateStx(
        2_000_000,
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

      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1_000_000,
          },
          {
            user: wallet_2,
            amountUstx: 10_000_000_000_000,
          },
        ],
        poxAddrPool1,
        40,
        deployer
      ),
      // increase amount for wallet_1
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 2_000_000,
          },
        ],
        poxAddrPool1,
        40,
        deployer
      ),
    ]);

    // verify results for allow contract caller
    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 2);
    // verify results for delegate-stx calls
    expectOkTrue(block, POX4_POOLS, "delegate-stx", 3);
    expectOkTrue(block, POX4_POOLS, "delegate-stx", 4);

    // verify delegate-stack-stx calls by pool operator
    let lockingInfoList = (block[5].result as ResponseOkCV<ListCV>).value.list;
    expectOkLockingResult(lockingInfoList[0], {
      lockAmount: 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2 * CYCLE,
    });
    expectOkLockingResult(lockingInfoList[1], {
      lockAmount: 10_000_000_000_000,
      stacker: wallet_2,
      unlockBurnHeight: 2 * CYCLE,
    });

    lockingInfoList = (block[6].result as ResponseOkCV<ListCV>).value.list;
    expectOkLockingResult(lockingInfoList[0], {
      lockAmount: 2_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2 * CYCLE,
    });

    // commit for cycle 1
    const rewardCycle = 1;
    const period = 1;
    const maxAmount = 100_000_000_000_000;
    let privateKey =
      "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801"; // private key wallet_1
    let signerKey = publicKeyToString(pubKeyfromPrivKey(privateKey));

    let poxAddress = poxAddressToBtcAddress(
      hexToBytes(poxAddrPool1.version.substring(2))[0],
      hexToBytes(poxAddrPool1.hashbytes.substring(2)),
      "testnet"
    );
    let authId = 1;

    block = simnet.mineBlock([
      stackAggregationCommitIndexed(
        poxAddrPool1,
        rewardCycle,
        signPox4SignatureHash({
          topic: Pox4SignatureTopic.AggregateCommit,
          period,
          rewardCycle,
          maxAmount,
          network: new StacksTestnet(),
          poxAddress,
          authId,
          privateKey: createStacksPrivateKey(privateKey),
        }),
        signerKey,
        maxAmount,
        authId,
        deployer
      ),
    ]);
    // verify that pox-addr-index = 0
    expect(block[0].result).toBeOk(Cl.uint(0));
    const total = getTotal(deployer, 1, deployer);
    // FIXME: Only 10_000_002 STX were locked
    expect(total.result).toBeUint(10_000_003_000_000);
  });

  it("Ensure that pool operator can't stack more than user balance", () => {
    const { CYCLE } = getCycleLength();

    let block = simnet.mineBlock([
      allowContractCaller(pox4PoolsContract, undefined, deployer),
      allowContractCaller(pox4PoolsContract, undefined, wallet_1),
      allowContractCaller(pox4PoolsContract, undefined, wallet_2),

      delegateStx(
        1_000_000,
        deployer,
        2 * CYCLE,
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
    ]);

    // verify results for allow contract caller
    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 2);
    // verify results for delegate-stx calls
    expectOkTrue(block, POX4_POOLS, "delegate-stx", 3);
    expectOkTrue(block, POX4_POOLS, "delegate-stx", 4);

    // return tokens to faucet
    // wallet_1 balance = 0
    block = simnet.mineBlock([
      tx.transferSTX(100_000_000_000_000, faucet, wallet_1),
    ]);

    block = simnet.mineBlock([
      // delegate stack stx
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1_000_000,
          },
          {
            user: wallet_2,
            amountUstx: 10_000_000_000_000,
          },
        ],
        poxAddrPool1,
        40,
        deployer
      ),
    ]);

    // verify delegate-stack-stx call by pool operator
    let lockingInfoList = (block[0].result as ResponseOkCV<ListCV>).value.list;
    expect(lockingInfoList[0]).toBeErr(Cl.uint(Errors.NonPositiveAmount));
    expectOkLockingResult(lockingInfoList[1], {
      lockAmount: 10_000_000_000_000,
      stacker: wallet_2,
      unlockBurnHeight: 2 * CYCLE,
    });

    // try again after loading wallet_1 with STX
    block = simnet.mineBlock([
      // transfer STX tokens to wallet_1
      tx.transferSTX(500_000, wallet_1, faucet),
      // delegate stack stx
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1_000_000,
          },
        ],
        poxAddrPool1,
        40,
        deployer
      ),
    ]);
    expectOkTrue(block, "transfer", "stx", 0);
    // verify info of wallet_1
    lockingInfoList = (block[1].result as ResponseOkCV<ListCV>).value.list;
    expectOkLockingResult(lockingInfoList[0], {
      lockAmount: 500_000,
      stacker: wallet_1,
      unlockBurnHeight: 2 * CYCLE,
    });
  });

  it("Ensure that pool operator can't stack after revoking", () => {
    const { CYCLE } = getCycleLength();

    let block = simnet.mineBlock([
      allowContractCaller(pox4PoolsContract, undefined, deployer),
      allowContractCaller(pox4PoolsContract, undefined, wallet_1),
      allowContractCaller(pox4PoolsContract, undefined, wallet_2),

      delegateStx(
        1_000_000,
        deployer,
        2 * CYCLE,
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
    ]);

    // verify results for allow contract caller
    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 2);
    // verify results for delegate-stx calls
    expectOkTrue(block, POX4_POOLS, "delegate-stx", 3);
    expectOkTrue(block, POX4_POOLS, "delegate-stx", 4);

    // revoke
    block = simnet.mineBlock([revokeDelegateStx(wallet_1)]);
    expect(block[0].result).toBeOk(
      Cl.some(
        Cl.tuple({
          "amount-ustx": Cl.uint(1_000_000),
          "delegated-to": Cl.principal(deployer),
          "pox-addr": Cl.none(),
          "until-burn-ht": Cl.some(Cl.uint(2 * CYCLE)),
        })
      )
    );

    block = simnet.mineBlock([
      // delegate stack stx
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1_000_000,
          },
          {
            user: wallet_2,
            amountUstx: 10_000_000_000_000,
          },
        ],
        poxAddrPool1,
        40,
        deployer
      ),
    ]);

    // verify delegate-stack-stx call by pool operator
    let lockingInfoList = (block[0].result as ResponseOkCV<ListCV>).value.list;

    expect(lockingInfoList[0]).toBeErr(
      Cl.uint(PoxErrors.StackingPermissionDenied * 1000)
    );
    expectOkLockingResult(lockingInfoList[1], {
      lockAmount: 10_000_000_000_000,
      stacker: wallet_2,
      unlockBurnHeight: 2 * CYCLE,
    });
  });

  it("Ensure that user can delegate more while stx are locked and pool operator can increase after unlocking", () => {
    const { CYCLE } = getCycleLength();

    let block = simnet.mineBlock([
      allowContractCaller(pox4PoolsContract, undefined, deployer),
      allowContractCaller(pox4PoolsContract, undefined, wallet_1),

      delegateStx(
        1_000_000,
        deployer,
        undefined,
        undefined,
        btcAddrWallet1,
        wallet_1
      ),

      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1_000_000,
          },
        ],
        poxAddrPool1,
        20,
        deployer
      ),
    ]);

    // verify results for allow contract caller
    expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
    expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
    // verify results for delegate-stx calls
    expectOkTrue(block, POX4_POOLS, "delegate-stx", 2);
    // verify delegate-stack-stx call by pool operator
    let lockingInfoList = (block[3].result as ResponseOkCV<ListCV>).value.list;
    expectOkLockingResult(lockingInfoList[0], {
      lockAmount: 1_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2 * CYCLE,
    });
    // increase delegation
    block = simnet.mineBlock([
      delegateStx(
        20_000_000,
        deployer,
        undefined,
        undefined,
        btcAddrWallet1,
        wallet_1
      ),
    ]);
    expectOkTrue(block, POX4_POOLS, "delegate-stx", 0);

    simnet.mineEmptyBlocks(CYCLE - 5);

    // try to lock more in same cycle
    block = simnet.mineBlock([
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 10_000_000,
          },
        ],
        poxAddrPool1,
        40,
        deployer
      ),
    ]);
    lockingInfoList = (block[0].result as ResponseOkCV<ListCV>).value.list;
    expectOkLockingResult(lockingInfoList[0], {
      lockAmount: 10_000_000,
      stacker: wallet_1,
      unlockBurnHeight: 2 * CYCLE,
    });

    // try to lock more at the start of the cycle
    // with a wrong start height
    // delegate-stack-stx fails with error !== 3
    block = simnet.mineBlock([
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 2_000_000,
          },
        ],
        poxAddrPool1,
        40,
        deployer
      ),
    ]);
    lockingInfoList = (block[0].result as ResponseOkCV<ListCV>).value.list;
    expect(lockingInfoList[0]).toBeErr(
      Cl.uint(PoxErrors.InvalidStartBurnHeight * 1_000)
    ); // error in pox-delegate-stack-extend

    expect(
      simnet.callReadOnlyFn(
        POX4_POOLS,
        "get-stx-account",
        [Cl.principal(wallet_1)],
        wallet_1
      ).result
    ).toBeTuple({
      locked: Cl.uint(10_000_000),
      "unlock-height": Cl.uint(2 * CYCLE),
      unlocked: Cl.uint(99_999_990_000_000),
    });
    expectOkStatus(getStatus(deployer, wallet_1, 1, wallet_1).result, {
      stackerInfo: { firstRewardCycle: 1 },
      userInfo: {
        hashbytes: btcAddrWallet1.hashbytes,
        version: btcAddrWallet1.version,
        cycle: 0,
        total: 11_000_000, // FIXME: should be 10 STX total
      },
    });

    // after another cycle all stx are unlocked and can be locked again
    simnet.mineEmptyBlocks(CYCLE);

    // user does not stack anymore
    const response = getStatus(deployer, wallet_1, 2, wallet_1);
    expect(response.result).toBeErr(Cl.uint(Errors.NoStackerInfo));

    block = simnet.mineBlock([
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 2_000_000,
          },
        ],
        poxAddrPool1,
        simnet.blockHeight + 10,
        deployer
      ),
    ]);
    lockingInfoList = (block[0].result as ResponseOkCV<ListCV>).value.list;
    expectOkLockingResult(lockingInfoList[0], {
      lockAmount: 2_000_000,
      stacker: wallet_1,
      // lock started in cycle 3 and unlocks in cycle 4;
      unlockBurnHeight: 4 * CYCLE,
    });
  });
});
