import { expectOkTrue } from "@stacks/clarunit/src/parser/test-helpers.ts";
import { hexToBytes } from "@stacks/common";
import {
  Pox4SignatureTopic,
  poxAddressToBtcAddress,
  signPox4SignatureHash,
} from "@stacks/stacking";
import {
  Cl,
  ClarityType,
  ListCV,
  OptionalCV,
  ResponseOkCV,
  SomeCV,
  TupleCV,
  createStacksPrivateKey,
  pubKeyfromPrivKey,
  publicKeyToString,
} from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import {
  allowContractCaller,
  getCycleLength,
  stackAggregationCommitIndexed,
  stackAggregationIncrease,
} from "./client/pox-4-client.js";
import {
  POX4_POOLS,
  delegateStackStx,
  delegateStx,
  expectOkStatus,
  expectStatusListNone,
  getStatus,
  getStatusList,
  getStatusListsLastIndex,
  pox4PoolsContract,
} from "./client/pox4-pools-client.ts";
import {
  btcAddrWallet1,
  btcAddrWallet2,
  poxAddrPool1,
  poxAddrPool2,
} from "./constants.ts";
import { expectOkLockingResult } from "./utils.ts";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const wallet_2 = accounts.get("wallet_2")!;
const pool_1 = accounts.get("wallet_7")!;
const pool_2 = accounts.get("wallet_8")!;

function delegateAndDelegateStx({ samePoxAddr }: { samePoxAddr: boolean }) {
  const { CYCLE } = getCycleLength();

  let block = simnet.mineBlock([
    allowContractCaller(pox4PoolsContract, undefined, wallet_1),
    allowContractCaller(pox4PoolsContract, undefined, wallet_2),
    allowContractCaller(pox4PoolsContract, undefined, pool_1),
    allowContractCaller(pox4PoolsContract, undefined, pool_2),

    delegateStx(
      10_000_000_000_000,
      pool_1,
      4300,
      undefined,
      btcAddrWallet1,
      wallet_1
    ),

    delegateStx(
      10_000_000_000_000,
      pool_2,
      undefined,
      undefined,
      btcAddrWallet2,
      wallet_2
    ),

    // lock users with locking period 1
    delegateStackStx(
      [
        {
          user: wallet_1,
          amountUstx: 10_000_000_000_000,
        },
      ],
      poxAddrPool1,
      40,
      pool_1
    ),

    // lock users with locking period 2
    delegateStackStx(
      [
        {
          user: wallet_2,
          amountUstx: 10_000_000_000_000,
        },
      ],
      samePoxAddr ? poxAddrPool1 : poxAddrPool2,
      40,
      pool_2
    ),
  ]);

  // verify results for allow contract caller
  expectOkTrue(block, "pox-4", "allow-contract-caller", 0);
  expectOkTrue(block, "pox-4", "allow-contract-caller", 1);
  expectOkTrue(block, "pox-4", "allow-contract-caller", 2);
  expectOkTrue(block, "pox-4", "allow-contract-caller", 3);
  // verify results for delegate-stx calls
  expectOkTrue(block, POX4_POOLS, "delegate-stx", 4);
  expectOkTrue(block, POX4_POOLS, "delegate-stx", 5);

  // verify delegate-stack-stx call by pool operator
  expect(block[6].result).toHaveClarityType(ClarityType.ResponseOk);
  let lockingInfoList = (block[6].result as ResponseOkCV<ListCV>).value.list;
  expectOkLockingResult(lockingInfoList[0], {
    lockAmount: 10_000_000_000_000,
    stacker: wallet_1,
    unlockBurnHeight: 2 * CYCLE,
  });

  expect(block[7].result).toHaveClarityType(ClarityType.ResponseOk);
  lockingInfoList = (block[7].result as ResponseOkCV<ListCV>).value.list;
  expectOkLockingResult(lockingInfoList[0], {
    lockAmount: 10_000_000_000_000,
    stacker: wallet_2,
    unlockBurnHeight: 2 * CYCLE,
  });
}

describe(POX4_POOLS + " many", () => {
  it("Ensure that users can delegate to two different pools using the same pox btc reward address.", () => {
    delegateAndDelegateStx({ samePoxAddr: true });

    // commit for cycle 1
    let privateKey =
      "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801"; // private key wallet_1
    let signerKey = publicKeyToString(pubKeyfromPrivKey(privateKey));

    let maxAmount = 100_000_000_000_000;
    let authId = 1;
    let authId2 = 2;
    let period = 1;
    let rewardCycle = 1;
    let poxAddress = poxAddressToBtcAddress(
      hexToBytes(poxAddrPool1.version.substring(2))[0],
      hexToBytes(poxAddrPool1.hashbytes.substring(2)),
      "testnet"
    );
    let block = simnet.mineBlock([
      stackAggregationCommitIndexed(
        poxAddrPool1,
        rewardCycle,
        signPox4SignatureHash({
          topic: Pox4SignatureTopic.AggregateCommit,
          period,
          rewardCycle,
          maxAmount,
          network: "testnet",
          poxAddress,
          authId,
          privateKey: createStacksPrivateKey(privateKey),
        }),
        signerKey,
        maxAmount,
        authId,
        pool_1
      ),

      // increase via pool_2
      // using authId = 2

      stackAggregationIncrease(
        poxAddrPool1,
        rewardCycle,
        0, // pox addr index
        signPox4SignatureHash({
          topic: "agg-increase" as Pox4SignatureTopic,
          period,
          rewardCycle,
          maxAmount,
          network: "testnet",
          poxAddress,
          authId: authId2,
          privateKey: createStacksPrivateKey(privateKey),
        }),
        signerKey,
        maxAmount,
        authId2,
        pool_2
      ),
    ]);

    // verify that pox-addr-index = 0
    expect(block[0].result).toBeOk(Cl.uint(0));
    expect(block[1].result).toBeOk(Cl.bool(true));

    // verify status for users with locking period 1
    let response = getStatusListsLastIndex(pool_1, 1, pool_1);
    expect(response.result).toBeUint(0);

    response = getStatusList(pool_1, 1, 0, pool_1);
    expect(response.result).toHaveClarityType(ClarityType.Tuple);

    let statusList = response.result as TupleCV<{
      "status-list": OptionalCV<ListCV>;
    }>;
    expect(statusList.data["status-list"]).toHaveClarityType(
      ClarityType.OptionalSome
    );
    expect(
      (statusList.data["status-list"] as SomeCV<ListCV<TupleCV>>).value.list[0]
        .data.cycle
    ).toBeUint(0);

    // verify that information are based on delegate-stx call only
    // if locking period is more than 1 cycle there is still only one entry
    response = getStatusList(pool_2, 2, 0, deployer);
    statusList = response.result as TupleCV<{
      "status-list": OptionalCV<ListCV>;
    }>;
    expect(statusList.data["status-list"]).toHaveClarityType(
      ClarityType.OptionalNone
    );

    // verify user status
    response = getStatus(pool_1, wallet_1, 1, deployer);

    expectOkStatus(response.result, {
      stackerInfo: { firstRewardCycle: 1 },
      userInfo: {
        cycle: 0,
        hashbytes: btcAddrWallet1.hashbytes,
        version: btcAddrWallet1.version,
        total: 10_000_000_000_000,
      },
    });

    response = getStatus(pool_2, wallet_2, 1, deployer);

    expectOkStatus(response.result, {
      stackerInfo: { firstRewardCycle: 1 },
      userInfo: {
        cycle: 0,
        hashbytes: btcAddrWallet2.hashbytes,
        version: btcAddrWallet2.version,
        total: 10_000_000_000_000,
      },
    });
  });

  it("Ensure that users can delegate to two different pools using different pox btc reward addresses.", () => {
    delegateAndDelegateStx({ samePoxAddr: false });

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
    let block = simnet.mineBlock([
      stackAggregationCommitIndexed(
        poxAddrPool1,
        rewardCycle,
        signPox4SignatureHash({
          topic: Pox4SignatureTopic.AggregateCommit,
          period,
          rewardCycle,
          maxAmount,
          network: "testnet",
          poxAddress,
          authId,
          privateKey: createStacksPrivateKey(privateKey),
        }),
        signerKey,
        maxAmount,
        authId,
        pool_1
      ),
    ]);

    // verify that pox-addr-index = 0 for pool 1
    expect(block[0].result).toBeOk(Cl.uint(0));

    // commit pool 2
    authId = 2;
    poxAddress = poxAddressToBtcAddress(
      hexToBytes(poxAddrPool2.version.substring(2))[0],
      hexToBytes(poxAddrPool2.hashbytes.substring(2)),
      "testnet"
    );
    block = simnet.mineBlock([
      stackAggregationCommitIndexed(
        poxAddrPool2,
        rewardCycle,
        signPox4SignatureHash({
          topic: Pox4SignatureTopic.AggregateCommit,
          period,
          rewardCycle,
          maxAmount,
          network: "testnet",
          poxAddress,
          authId,
          privateKey: createStacksPrivateKey(privateKey),
        }),
        signerKey,
        maxAmount,
        authId,
        pool_2
      ),
    ]);
    // verify that pox-addr-index = 1 for pool 2
    expect(block[0].result).toBeOk(Cl.uint(1));

    // verify status for users with locking period 1
    let response = getStatusListsLastIndex(pool_1, 1, pool_1);
    expect(response.result).toBeUint(0);

    response = getStatusList(pool_1, 1, 0, pool_1);
    expect(response.result).toHaveClarityType(ClarityType.Tuple);

    let statusList = response.result as TupleCV<{
      "status-list": OptionalCV<ListCV>;
    }>;
    expect(statusList.data["status-list"]).toHaveClarityType(
      ClarityType.OptionalSome
    );
    expect(
      (statusList.data["status-list"] as SomeCV<ListCV<TupleCV>>).value.list[0]
        .data.cycle
    ).toBeUint(0);

    // verify that information are based on delegate-stx call only
    // there is always only one entry
    response = getStatusList(pool_2, 2, 0, deployer);
    expectStatusListNone(response.result);

    // verify user status
    response = getStatus(pool_1, wallet_1, 1, deployer);
    expectOkStatus(response.result, {
      stackerInfo: { firstRewardCycle: 1 },
      userInfo: {
        cycle: 0,
        hashbytes: btcAddrWallet1.hashbytes,
        version: btcAddrWallet1.version,
        total: 10_000_000_000_000,
      },
    });

    response = getStatus(pool_2, wallet_2, 1, deployer);
    expectOkStatus(response.result, {
      stackerInfo: { firstRewardCycle: 1 },
      userInfo: {
        cycle: 0,
        hashbytes: btcAddrWallet2.hashbytes,
        version: btcAddrWallet2.version,
        total: 10_000_000_000_000,
      },
    });
  });
});
