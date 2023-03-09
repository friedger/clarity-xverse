import {
  allowContractCaller,
  stackAggregationCommitIndexed,
} from "./client/pox-2-client.ts";
import {
  delegateStackStx,
  delegateStx,
  getStatus,
  getUserData,
} from "./client/pox-delegation-client.ts";
import { Clarinet, Tx, Chain, Account, types } from "./deps.ts";
import {
  Errors,
  PoxErrors,
  btcAddrWallet1,
  btcAddrWallet2,
  poxAddrPool1,
} from "./constants.ts";

Clarinet.test({
  name: "Ensure that users can delegate",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const poxDelegationContract = deployer.address + ".pox-delegation";

    let block = chain.mineBlock([
      allowContractCaller(poxDelegationContract, undefined, wallet_1),
      delegateStx(
        1_000_000,
        deployer.address,
        100,
        undefined,
        { version: "0x01", hashbytes: "0x123456" },
        2,
        wallet_1
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "Ensure that users can't delegate without allowing contract",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet_1 = accounts.get("wallet_1")!;
    let deployer = accounts.get("deployer")!;

    let block = chain.mineBlock([
      delegateStx(
        100_000_000,
        deployer.address,
        100,
        undefined,
        { version: "0x01", hashbytes: "0x123456" },
        2,
        wallet_1
      ),
    ]);

    block.receipts[0].result
      .expectErr()
      .expectUint(PoxErrors.StackingPermissionDenied * 1000);
  },
});

Clarinet.test({
  name: "Ensure that user can't lock stx",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    const poxDelegationContract = deployer.address + ".pox-delegation";

    let block = chain.mineBlock([
      allowContractCaller(poxDelegationContract, undefined, wallet_1),

      delegateStx(
        1_000_000_000,
        deployer.address,
        4000,
        undefined,
        {
          version: "0x01",
          hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
        },
        2,
        wallet_1
      ),

      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1000000,
          },
        ],
        {
          version: "0x01",
          hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
        },
        2,
        2,
        wallet_2
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    // verify delegate-stack-stx by wallet 2
    let lockingInfoList = block.receipts[2].result.expectOk().expectList();
    lockingInfoList[0]
      .expectErr()
      .expectUint(PoxErrors.StackingPermissionDenied * 1000);
  },
});

Clarinet.test({
  name: "Ensure that pool operator can't lock for non-member",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    const poxDelegationContract = deployer.address + ".pox-delegation";

    let block = chain.mineBlock([
      allowContractCaller(poxDelegationContract, undefined, deployer),

      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1000000,
          },
        ],
        poxAddrPool1,
        40,
        1,
        deployer
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    // verify delegate-stack-stx by wallet 2
    let lockingInfoList = block.receipts[1].result.expectOk().expectList();
    lockingInfoList[0].expectErr().expectUint(Errors.NotFound);
  },
});

Clarinet.test({
  name: "Ensure that getStatus returns correct values",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    let pool_1 = accounts.get("deployer")!;
    let pool_2 = accounts.get("wallet_8")!;
    const poxDelegationContract = pool_1.address + ".pox-delegation";
    const lockingPeriod = 2;

    // info before delegation
    let response = getStatus(pool_1.address, wallet_1.address, chain, wallet_1);
    response.result.expectErr().expectUint(Errors.NoStackerInfo);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result.expectNone();

    let block = chain.mineBlock([
      allowContractCaller(poxDelegationContract, undefined, wallet_1),
      allowContractCaller(poxDelegationContract, undefined, wallet_2),
      allowContractCaller(poxDelegationContract, undefined, pool_1),

      delegateStx(
        100_000_000,
        pool_1.address,
        undefined,
        undefined,
        btcAddrWallet1,
        lockingPeriod,
        wallet_1
      ),
      delegateStx(
        10_000_000_000_000,
        pool_1.address,
        undefined,
        undefined,
        btcAddrWallet2,
        lockingPeriod,
        wallet_2
      ),
    ]);
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();
    block.receipts[2].result.expectOk();
    block.receipts[3].result.expectOk();

    // info before stacking
    response = getStatus(pool_1.address, wallet_1.address, chain, wallet_1);
    response.result.expectErr().expectUint(Errors.NoStackerInfo);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result.expectSome().expectTuple()["lock-period"].expectUint(2);

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
        lockingPeriod,
        pool_1
      ),
    ]);
    block.receipts[0].result
      .expectOk()
      .expectList()
      .map((info: any) => info.expectOk());

    response = getStatus(pool_1.address, wallet_1.address, chain, wallet_1);
    let info = response.result.expectOk().expectTuple();
    info["stacker-info"].expectTuple();
    info["user-info"].expectTuple();
    info["total"].expectUint(100_000_000);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result.expectSome().expectTuple()["lock-period"].expectUint(2);

    // status after commit
    block = chain.mineBlock([
      stackAggregationCommitIndexed(poxAddrPool1, 1, pool_1),
    ]);
    block.receipts[0].result
      .expectErr()
      .expectInt(PoxErrors.StackingThresholdNotMet);

    response = getStatus(pool_1.address, wallet_1.address, chain, wallet_1);
    info = response.result.expectOk().expectTuple();
    info["stacker-info"].expectTuple();
    info["user-info"].expectTuple();
    info["total"].expectUint(100_000_000);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result.expectSome().expectTuple()["lock-period"].expectUint(2);

    // get status with wrong pool address
    response = getStatus(pool_2.address, wallet_1.address, chain, wallet_1);
    info = response.result.expectOk().expectTuple();
    info["total"].expectUint(0);

    response = getUserData(wallet_1.address, chain, wallet_1);
    response.result.expectSome().expectTuple()["lock-period"].expectUint(2);
  },
});
