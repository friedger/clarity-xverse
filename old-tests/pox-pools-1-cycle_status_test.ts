import {
  allowContractCaller,
  stackAggregationCommitIndexed,
} from "./client/pox-4-client.js";
import {
  delegateStackStx,
  delegateStx,
  getNotLockedForCycle,
  getStatus,
  getUserData,
} from "./client/pox-pools-1-cycle-client.ts";
import { Clarinet, Tx, Chain, Account, types } from "./deps.ts";
import {
  Errors,
  PoxErrors,
  btcAddrWallet1,
  btcAddrWallet2,
  poxAddrPool1,
} from "./constants.ts";
import { toBytes, hexToBytes } from "https://esm.sh/@stacks/common";

Clarinet.test({
  name: "Ensure that getStatus returns correct values",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    let pool_1 = accounts.get("deployer")!;
    let pool_2 = accounts.get("wallet_8")!;
    const poxPools1CycleContract = pool_1.address + ".pox-pools-1-cycle";

    // info before delegation
    let response = getStatus(
      pool_1.address,
      wallet_1.address,
      1,
      chain,
      wallet_1
    );
    response.result.expectErr().expectUint(Errors.NoStackerInfo);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result.expectNone();

    let block = chain.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_2),
      allowContractCaller(poxPools1CycleContract, undefined, pool_1),

      delegateStx(
        100_000_000,
        pool_1.address,
        undefined,
        undefined,
        btcAddrWallet1,
        wallet_1
      ),
      delegateStx(
        10_000_000_000_000,
        pool_1.address,
        undefined,
        undefined,
        btcAddrWallet2,
        wallet_2
      ),
    ]);
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();
    block.receipts[2].result.expectOk();
    block.receipts[3].result.expectOk();

    // info before stacking
    response = getStatus(pool_1.address, wallet_1.address, 1, chain, wallet_1);
    response.result.expectErr().expectUint(Errors.NoStackerInfo);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result
      .expectSome()
      .expectTuple()
      ["pox-addr"].expectTuple()
      .hashbytes.expectBuff(
        hexToBytes("000102030405060708090a0b0c0d0e0f00010203")
      );

    block = chain.mineBlock([
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 100_000_000,
          },
        ],
        poxAddrPool1,
        40,
        pool_1
      ),
    ]);
    block.receipts[0].result
      .expectOk()
      .expectList()
      .map((info: any) => info.expectOk());

    response = getStatus(pool_1.address, wallet_1.address, 1, chain, wallet_1);
    let info = response.result.expectOk().expectTuple();
    info["stacker-info"].expectTuple();
    info["user-info"].expectTuple();
    info["total"].expectUint(100_000_000);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result
      .expectSome()
      .expectTuple()
      ["pox-addr"].expectTuple()
      .hashbytes.expectBuff(
        hexToBytes("000102030405060708090a0b0c0d0e0f00010203")
      );

    // status after commit
    block = chain.mineBlock([
      stackAggregationCommitIndexed(poxAddrPool1, 1, pool_1),
    ]);
    block.receipts[0].result
      .expectErr()
      .expectInt(PoxErrors.StackingThresholdNotMet);

    response = getStatus(pool_1.address, wallet_1.address, 1, chain, wallet_1);
    info = response.result.expectOk().expectTuple();
    info["stacker-info"].expectTuple();
    info["user-info"].expectTuple();
    info["total"].expectUint(100_000_000);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result
      .expectSome()
      .expectTuple()
      ["pox-addr"].expectTuple()
      .hashbytes.expectBuff(
        hexToBytes("000102030405060708090a0b0c0d0e0f00010203")
      );

    // get status with wrong pool address
    response = getStatus(pool_2.address, wallet_1.address, 1, chain, wallet_1);
    info = response.result.expectOk().expectTuple();
    info["total"].expectUint(0);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result
      .expectSome()
      .expectTuple()
      ["pox-addr"].expectTuple()
      .hashbytes.expectBuff(
        hexToBytes("000102030405060708090a0b0c0d0e0f00010203")
      );
  },
});

Clarinet.test({
  name: "Ensure that unlock height checks are correct",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet_1 = accounts.get("wallet_1")!;

    let response = getNotLockedForCycle(10, 1, chain, wallet_1);
    response.result.expectBool(true);
    response = getNotLockedForCycle(1050, 1, chain, wallet_1);
    response.result.expectBool(true);
    response = getNotLockedForCycle(1051, 1, chain, wallet_1);
    response.result.expectBool(false);
    response = getNotLockedForCycle(2100, 1, chain, wallet_1);
    response.result.expectBool(false);
    response = getNotLockedForCycle(2100, 2, chain, wallet_1);
    response.result.expectBool(true);
    response = getNotLockedForCycle(2101, 2, chain, wallet_1);
    response.result.expectBool(false);
  },
});
