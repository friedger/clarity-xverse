import { hexToBytes } from "https://esm.sh/@stacks/common";
import {
  allowContractCaller,
  getCycleLength,
  stackAggregationCommitIndexed,
  stackAggregationIncrease,
} from "./client/pox-4-client.js";
import {
  delegateStackStx,
  delegateStx,
  getStatus,
  getStatusList,
  getStatusListsLastIndex,
} from "./client/pox-pools-1-cycle-client.ts";
import {
  btcAddrWallet1,
  btcAddrWallet2,
  poxAddrPool1,
  poxAddrPool2,
} from "./constants.ts";
import { Account, Chain, Clarinet } from "./deps.ts";

async function delegateAndDelegateStx(
  chain: Chain,
  accounts: Map<string, Account>,
  { samePoxAddr }: { samePoxAddr: boolean }
) {
  let deployer = accounts.get("deployer")!;
  let wallet_1 = accounts.get("wallet_1")!;
  let wallet_2 = accounts.get("wallet_2")!;
  let pool_1 = accounts.get("wallet_7")!;
  let pool_2 = accounts.get("wallet_8")!;
  const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);
  const poxPools1CycleContract = deployer.address + ".pox-pools-1-cycle";

  let block = chain.mineBlock([
    allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
    allowContractCaller(poxPools1CycleContract, undefined, wallet_2),
    allowContractCaller(poxPools1CycleContract, undefined, pool_1),
    allowContractCaller(poxPools1CycleContract, undefined, pool_2),

    delegateStx(
      10_000_000_000_000,
      pool_1.address,
      4300,
      undefined,
      btcAddrWallet1,
      wallet_1
    ),

    delegateStx(
      10_000_000_000_000,
      pool_2.address,
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
  block.receipts[0].result.expectOk().expectBool(true);
  block.receipts[1].result.expectOk().expectBool(true);
  block.receipts[2].result.expectOk().expectBool(true);
  block.receipts[3].result.expectOk().expectBool(true);
  // verify results for delegate-stx calls
  block.receipts[4].result.expectOk().expectBool(true);
  block.receipts[5].result.expectOk().expectBool(true);

  // verify delegate-stack-stx call by pool operator
  let lockingInfoList = block.receipts[6].result.expectOk().expectList();
  lockingInfoList[0]
    .expectOk()
    .expectTuple()
    ["unlock-burn-height"].expectUint(2 * CYCLE);

  lockingInfoList = block.receipts[7].result.expectOk().expectList();
  lockingInfoList[0]
    .expectOk()
    .expectTuple()
    ["unlock-burn-height"].expectUint(2 * CYCLE);
}

Clarinet.test({
  name: "Ensure that users can delegate to two different pools using the same pox btc reward address.",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    let pool_1 = accounts.get("wallet_7")!;
    let pool_2 = accounts.get("wallet_8")!;

    await delegateAndDelegateStx(chain, accounts, { samePoxAddr: true });

    // commit for cycle 1
    let block = chain.mineBlock([
      stackAggregationCommitIndexed(poxAddrPool1, 1, pool_1),
      stackAggregationIncrease(poxAddrPool1, 1, 0, pool_2),
    ]);
    // verify that pox-addr-index = 0
    block.receipts[0].result.expectOk().expectUint(0);
    block.receipts[1].result.expectOk().expectBool(true);

    // verify status for users with locking period 1
    let response = getStatusListsLastIndex(pool_1.address, 1, chain, pool_1);
    response.result.expectUint(0);

    response = getStatusList(pool_1.address, 1, 0, chain, pool_1);
    let statusList = response.result.expectTuple();
    let members = statusList["status-list"].expectSome().expectList();
    members[0].expectTuple().cycle.expectUint(0);

    // verify that information are based on delegate-stx call only
    // if locking period is more than 1 cycle there is still only one entry
    response = getStatusList(pool_2.address, 2, 0, chain, deployer);
    statusList = response.result.expectTuple();
    members = statusList["status-list"].expectNone();

    // verify user status
    response = getStatus(pool_1.address, wallet_1.address, 2, chain, deployer);

    let info = response.result.expectOk().expectTuple();
    info["stacker-info"].expectTuple()["first-reward-cycle"].expectUint(1);
    info["user-info"].expectTuple().cycle.expectUint(0);
    info["user-info"]
      .expectTuple()
      ["pox-addr"].expectTuple()
      .hashbytes.expectBuff(
        hexToBytes("000102030405060708090a0b0c0d0e0f00010203")
      );

    info["total"].expectUint(10_000_000_000_000);

    response = getStatus(pool_2.address, wallet_2.address, 2, chain, deployer);

    info = response.result.expectOk().expectTuple();
    info["stacker-info"].expectTuple()["first-reward-cycle"].expectUint(1);
    info["user-info"].expectTuple().cycle.expectUint(0);
    info["user-info"]
      .expectTuple()
      ["pox-addr"].expectTuple()
      .hashbytes.expectBuff(
        hexToBytes("00102030405060708090a0b0c0d0e0f000102030")
      );

    info["total"].expectUint(10_000_000_000_000);
  },
});

Clarinet.test({
  name: "Ensure that users can delegate to two different pools using different pox btc reward addresses.",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    let pool_1 = accounts.get("wallet_7")!;
    let pool_2 = accounts.get("wallet_8")!;

    await delegateAndDelegateStx(chain, accounts, { samePoxAddr: false });

    // commit for cycle 1
    let block = chain.mineBlock([
      stackAggregationCommitIndexed(poxAddrPool1, 1, pool_1),
      stackAggregationCommitIndexed(poxAddrPool2, 1, pool_2),
    ]);
    // verify that pox-addr-index = 0 for pool 1
    block.receipts[0].result.expectOk().expectUint(0);
    // verify that pox-addr-index = 1 for pool 2
    block.receipts[1].result.expectOk().expectUint(1);

    // verify status for users with locking period 1
    let response = getStatusListsLastIndex(pool_1.address, 1, chain, pool_1);
    response.result.expectUint(0);

    response = getStatusList(pool_1.address, 1, 0, chain, pool_1);
    let statusList = response.result.expectTuple();
    let members = statusList["status-list"].expectSome().expectList();
    members[0].expectTuple().cycle.expectUint(0);

    // verify that information are based on delegate-stx call only
    // there is always only one entry
    response = getStatusList(pool_2.address, 2, 0, chain, deployer);
    statusList = response.result.expectTuple();
    members = statusList["status-list"].expectNone();

    // verify user status
    response = getStatus(pool_1.address, wallet_1.address, 2, chain, deployer);

    let info = response.result.expectOk().expectTuple();
    info["stacker-info"].expectTuple()["first-reward-cycle"].expectUint(1);
    info["user-info"].expectTuple().cycle.expectUint(0);
    info["user-info"]
      .expectTuple()
      ["pox-addr"].expectTuple()
      .hashbytes.expectBuff(
        hexToBytes("000102030405060708090a0b0c0d0e0f00010203")
      );

    info["total"].expectUint(10_000_000_000_000);

    response = getStatus(pool_2.address, wallet_2.address, 2, chain, deployer);

    info = response.result.expectOk().expectTuple();
    info["stacker-info"].expectTuple()["first-reward-cycle"].expectUint(1);
    info["user-info"].expectTuple().cycle.expectUint(0);
    info["user-info"]
      .expectTuple()
      ["pox-addr"].expectTuple()
      .hashbytes.expectBuff(
        hexToBytes("00102030405060708090a0b0c0d0e0f000102030")
      );

    info["total"].expectUint(10_000_000_000_000);
  },
});
