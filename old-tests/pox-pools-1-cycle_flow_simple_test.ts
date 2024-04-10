import {
  allowContractCaller,
  stackAggregationCommitIndexed,
} from "./client/pox-4-client.js";
import {
  delegateStackStxSimple,
  delegateStx,
} from "./client/pox-pools-1-cycle-client.ts";
import { Clarinet, Tx, Chain, Account, types } from "./deps.ts";
import { btcAddrWallet1, btcAddrWallet2, poxAddrPool1 } from "./constants.ts";

Clarinet.test({
  name: "Ensure that user can delegate and pool operator can lock stx without detailed amount",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    const poxPools1CycleContract = deployer.address + ".pox-pools-1-cycle";

    let block = chain.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, deployer),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_2),

      delegateStx(
        1_000_000,
        deployer.address,
        6300,
        undefined,
        btcAddrWallet1,
        wallet_1
      ),

      delegateStx(
        10_000_000_000_000,
        deployer.address,
        undefined,
        undefined,
        btcAddrWallet2,
        wallet_2
      ),

      delegateStackStxSimple([wallet_1, wallet_2], poxAddrPool1, 40, deployer),
    ]);

    // verify results for allow contract caller
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result.expectOk().expectBool(true);
    // verify results for delegate-stx calls
    block.receipts[3].result.expectOk().expectBool(true);
    block.receipts[4].result.expectOk().expectBool(true);

    // verify delegate-stack-stx call by pool operator
    let lockingInfoList = block.receipts[5].result.expectOk().expectList();
    lockingInfoList[0]
      .expectOk()
      .expectTuple()
      ["lock-amount"].expectUint(1_000_000);

    lockingInfoList[1]
      .expectOk()
      .expectTuple()
      ["lock-amount"].expectUint(9_999_999_000_000);

    console.log(lockingInfoList);
  },
});
