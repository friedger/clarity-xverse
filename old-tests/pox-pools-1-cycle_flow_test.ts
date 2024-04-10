import {
  allowContractCaller,
  getCycleLength,
  revokeDelegateStx,
  stackAggregationCommitIndexed,
} from "./client/pox-4-client.js";
import {
  delegateStackStx,
  delegateStx,
  getStatus,
} from "./client/pox-pools-1-cycle-client.ts";
import {
  Errors,
  PoxErrors,
  btcAddrWallet1,
  btcAddrWallet2,
  poxAddrPool1,
} from "./constants.ts";
import { Account, Chain, Clarinet, Tx, assertEquals, types } from "./deps.ts";

Clarinet.test({
  name: "Ensure that user can delegate and pool operator can lock stx and aggregate commit",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);
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
      ["unlock-burn-height"].expectUint(2 * CYCLE);

    lockingInfoList[1]
      .expectOk()
      .expectTuple()
      ["unlock-burn-height"].expectUint(2 * CYCLE);

    // commit for cycle 1
    block = chain.mineBlock([
      stackAggregationCommitIndexed(poxAddrPool1, 1, deployer),
    ]);
    // verify that pox-addr-index = 0
    block.receipts[0].result.expectOk().expectUint(0);
  },
});

Clarinet.test({
  name: "Ensure that pool operator can't stack more than user balance",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    let faucet = accounts.get("faucet")!;
    const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);
    const poxPools1CycleContract = deployer.address + ".pox-pools-1-cycle";

    let block = chain.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, deployer),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_2),

      delegateStx(
        1_000_000,
        deployer.address,
        2 * CYCLE,
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
    ]);

    // verify results for allow contract caller
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result.expectOk().expectBool(true);
    // verify results for delegate-stx calls
    block.receipts[3].result.expectOk().expectBool(true);
    block.receipts[4].result.expectOk().expectBool(true);

    // return tokens to faucet
    // wallet_1 balance = 0
    block = chain.mineBlock([
      Tx.transferSTX(100_000_000_000_000, faucet.address, wallet_1.address),
    ]);

    block = chain.mineBlock([
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
    let lockingInfoList = block.receipts[0].result.expectOk().expectList();
    lockingInfoList[0].expectErr().expectUint(Errors.NonPositiveAmount);

    let info = lockingInfoList[1].expectOk().expectTuple();
    info["unlock-burn-height"].expectUint(2 * CYCLE);

    // try again after loading wallet_1 with STX
    block = chain.mineBlock([
      // transfer STX tokens to wallet_1
      Tx.transferSTX(500_000, wallet_1.address, faucet.address),
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
    block.receipts[0].result.expectOk().expectBool(true);
    // verify info of wallet_1
    lockingInfoList = block.receipts[1].result.expectOk().expectList();
    info = lockingInfoList[0].expectOk().expectTuple();
    info["lock-amount"].expectUint(500_000);
  },
});

Clarinet.test({
  name: "Ensure that pool operator can't stack after revoking",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);
    const poxPools1CycleContract = deployer.address + ".pox-pools-1-cycle";

    let block = chain.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, deployer),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_2),

      delegateStx(
        1_000_000,
        deployer.address,
        2 * CYCLE,
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
    ]);

    // verify results for allow contract caller
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result.expectOk().expectBool(true);
    // verify results for delegate-stx calls
    block.receipts[3].result.expectOk().expectBool(true);
    block.receipts[4].result.expectOk().expectBool(true);

    // revoke
    block = chain.mineBlock([revokeDelegateStx(wallet_1)]);
    block.receipts[0].result.expectOk().expectBool(true);

    block = chain.mineBlock([
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
    let lockingInfoList = block.receipts[0].result.expectOk().expectList();
    lockingInfoList[0]
      .expectErr()
      .expectUint(PoxErrors.StackingPermissionDenied * 1000);

    let info = lockingInfoList[1].expectOk().expectTuple();
    info["unlock-burn-height"].expectUint(2 * CYCLE);
  },
});

Clarinet.test({
  name: "See that in simnet user can delegate more while stx are locked and pool operator can increase after unlocking",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    const { CYCLE, HALF_CYCLE, PREPARE_CYCLE_LENGTH } = await getCycleLength(
      chain
    );
    const poxPools1CycleContract = deployer.address + ".pox-pools-1-cycle";

    let block = chain.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, deployer),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),

      delegateStx(
        1_000_000,
        deployer.address,
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
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    // verify results for delegate-stx calls
    block.receipts[2].result.expectOk().expectBool(true);
    // verify delegate-stack-stx call by pool operator
    block.receipts[3].result
      .expectOk()
      .expectList()
      .map((r: any) => r.expectOk());

    let info = block.receipts[3].result
      .expectOk()
      .expectList()[0]
      .expectOk()
      .expectTuple();
    info["lock-amount"].expectUint(1_000_000);
    info["unlock-burn-height"].expectUint(2 * CYCLE);

    // increase delegation
    block = chain.mineBlock([
      delegateStx(
        2_000_000,
        deployer.address,
        undefined,
        undefined,
        btcAddrWallet1,
        wallet_1
      ),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    chain.mineEmptyBlock(CYCLE - 3);

    // try to lock more in same cycle
    // but simnet always returns a wrong first-reward-cyle (0)
    // trying to extend fails with underflow error
    block = chain.mineBlock([
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
    assertEquals(block.receipts.length, 0); // Function calls throw ArithmeticUnderFlow error

    // try to lock more at the start of the cycle
    // with a wrong start height
    // delegate-stack-stx fails with error !== 3
    block = chain.mineBlock([
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
    assertEquals(block.receipts.length, 1);

    let lockingInfoList = block.receipts[0].result.expectOk().expectList();
    lockingInfoList[0]
      .expectErr()
      .expectUint(PoxErrors.InvalidStartBurnHeight * 1_000); // error in pox-delegate-stack-extend

    console.log(
      "*** stx-account",
      chain.callReadOnlyFn(
        "pox-pools-1-cycle",
        "get-stx-account",
        [types.principal(wallet_1.address)],
        wallet_1.address
      ),
      getStatus(deployer.address, wallet_1.address, chain, wallet_1).result
    );

    // after another cycle all stx are unlocked and can be locked again
    block = chain.mineEmptyBlock(CYCLE);

    // user does not stack anymore
    const response = getStatus(
      deployer.address,
      wallet_1.address,
      chain,
      wallet_1
    );
    response.result.expectErr().expectUint(Errors.NoStackerInfo);

    block = chain.mineBlock([
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 2_000_000,
          },
        ],
        poxAddrPool1,
        block.block_height + 10,
        deployer
      ),
    ]);
    info = block.receipts[0].result
      .expectOk()
      .expectList()[0]
      .expectOk()
      .expectTuple();
    info["lock-amount"].expectUint(2_000_000);
    // lock started in cycle 3 and unlocks in cycle 4;
    info["unlock-burn-height"].expectUint(4 * CYCLE);
  },
});
