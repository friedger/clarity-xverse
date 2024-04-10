import {
  allowContractCaller,
  stackAggregationCommitIndexed,
} from "./client/pox-4-client.js";
import {
  delegateStackStx,
  delegateStx,
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

Clarinet.test({
  name: "Ensure that users can delegate",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const poxPools1CycleContract = deployer.address + ".pox-pools-1-cycle";

    let block = chain.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
      delegateStx(
        1_000_000,
        deployer.address,
        100,
        undefined,
        { version: "0x01", hashbytes: "0x123456" },
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
    const poxPools1CycleContract = deployer.address + ".pox-pools-1-cycle";

    let block = chain.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),

      delegateStx(
        1_000_000_000,
        deployer.address,
        4000,
        undefined,
        {
          version: "0x01",
          hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
        },
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
    const poxPools1CycleContract = deployer.address + ".pox-pools-1-cycle";

    let block = chain.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, deployer),

      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1000000,
          },
        ],
        poxAddrPool1,
        40,
        deployer
      ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    // verify delegate-stack-stx by wallet 2
    let lockingInfoList = block.receipts[1].result.expectOk().expectList();
    lockingInfoList[0].expectErr().expectUint(Errors.NotFound);
  },
});
