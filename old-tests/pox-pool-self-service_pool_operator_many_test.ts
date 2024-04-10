import {
  allowContractCaller,
  asyncExpectCurrentCycle,
  getCycleLength,
  delegateStx as poxDelegateStx,
} from "./client/pox-4-client.js";
import {
  delegateStackStx,
  delegateStackStxMany,
  delegateStx,
} from "./client/pox-pool-self-service-client.ts";
import { poxAddrFP } from "./constants.ts";
import { Account, Chain, Clarinet, assertEquals } from "./deps.ts";
import {
  expectPartialStackedByCycle,
  expectTotalStackedByCycle,
} from "./utils.ts";

Clarinet.test({
  name: "See that on simnet users can't lock for others",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const poxPoolsSelfServiceContract =
      deployer.address + ".pox-pool-self-service";
    const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);
    chain.mineEmptyBlock(2 * CYCLE);

    let block = chain.mineBlock([
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_1),
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_2),

      delegateStx(20_000_000_000_000, wallet_1),
      delegateStx(2_000_000, wallet_2),
    ]);

    // check allow contract caller
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    // check delegation calls
    block.receipts[2].result
      .expectOk()
      .expectTuple()
      ["commit-result"].expectBool(true);
    block.receipts[3].result
      .expectOk()
      .expectTuple()
      ["commit-result"].expectBool(true);

    chain.mineEmptyBlock(HALF_CYCLE);

    block = chain.mineBlock([
      delegateStackStxMany([wallet_1, wallet_2], deployer),
    ]);

    // any call to delegate-stack-extend for a locked user
    // fails with an underflow error
    // therefore the many call throws the error
    assertEquals(block.receipts.length, 0);
  },
});

Clarinet.test({
  name: "Ensure that user can lock for others who used pox",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const poxPoolSelfServiceContract =
      deployer.address + ".pox-pool-self-service";
    const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);
    chain.mineEmptyBlock(2 * CYCLE);

    let block = chain.mineBlock([
      //no allow call for wallet_1
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_2),

      poxDelegateStx(20_000_000_000_000, poxPoolSelfServiceContract, wallet_1),
      delegateStx(2_000_000, wallet_2),
    ]);

    // check allow contract caller
    block.receipts[0].result.expectOk().expectBool(true);
    // check delegation calls
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result
      .expectOk()
      .expectTuple()
      ["commit-result"].expectBool(false); // no aggregation

    chain.mineEmptyBlock(HALF_CYCLE);

    block = chain.mineBlock([
      delegateStackStxMany([wallet_1, wallet_2], deployer),
    ]);
    // any call to delegate-stack-extend for a locked user
    // fails with an underflow error
    // therefore the many call throws the error
    /*
    block.receipts[0].result.expectOk().expectList();
    resultList[0]
      .expectOk()
      .expectTuple()
      ["lock-amount"].expectUint(19999999000000);
    resultList[1]
      .expectErr()
      .expectUint(PoxErrors.StackExtendNotLocked * 1000000);
      */

    assertEquals(block.receipts.length, 0);
  },
});

Clarinet.test({
  name: "See that in simnet user can't increase amount for next cycle",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);

    const poxPoolsSelfServiceContract =
      deployer.address + ".pox-pool-self-service";

    chain.mineEmptyBlock(CYCLE);
    // current cycle is cycle 1
    await asyncExpectCurrentCycle(chain, 1);

    // delegate 20 stx for cycle 2
    let block = chain.mineBlock([
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_1),
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_2),
      delegateStx(20_000_000, wallet_1),
      delegateStx(20_000_000, wallet_2),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result
      .expectOk()
      .expectTuple()
      ["commit-result"].expectBool(false);
    block.receipts[3].result
      .expectOk()
      .expectTuple()
      ["commit-result"].expectBool(false);

    expectPartialStackedByCycle(poxAddrFP, 2, 38_000_000, chain, deployer);
    expectTotalStackedByCycle(2, 0, undefined, chain, deployer);

    chain.mineEmptyBlock(CYCLE + HALF_CYCLE + 1);

    // increase delegation to 3 stx for cycle 3
    block = chain.mineBlock([
      delegateStackStxMany([wallet_1, wallet_2], deployer),
    ]);

    // support for simnet is limited, in particular stx-account returns other values
    // therefore, delegate-stack-extends fails with an underflow error
    // as stx-account unlock-height returns 0.
    // block.receipts[0].result.expectOk().expectList()[0].expectOk().expectTuple();
    // block.receipts[1].result.expectOk().expectList()[0].expectOk().expectTuple();
    assertEquals(block.receipts.length, 0);
  },
});

Clarinet.test({
  name: "See that in simnet user can extend for next cycle for any user",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const poxPoolsSelfServiceContract =
      deployer.address + ".pox-pool-self-service";
    const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);

    let block = chain.mineBlock([
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_1),
      delegateStx(2_000_000, wallet_1),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result
      .expectOk()
      .expectTuple()
      ["commit-result"].expectBool(false);

    expectPartialStackedByCycle(poxAddrFP, 1, 1_000_000, chain, deployer);
    expectPartialStackedByCycle(poxAddrFP, 2, undefined, chain, deployer);

    // advance to middle of next cycle
    block = chain.mineEmptyBlock(CYCLE + HALF_CYCLE - 1);
    // try to extend to cycle 3 early
    block = chain.mineBlock([delegateStackStx(wallet_1, wallet_2)]);
    assertEquals(block.height, CYCLE + HALF_CYCLE + 2);
    // any call to delegate-stack-extend for a user with locked stx fails
    // with an underflow error because stx-account returns always 0
    // for unlock height
    assertEquals(block.receipts.length, 1);
    block.receipts[0].result.expectErr().expectUint(500); // too early

    // extend to cycle 3
    block = chain.mineBlock([delegateStackStx(wallet_1, wallet_2)]);
    expectPartialStackedByCycle(poxAddrFP, 3, undefined, chain, deployer);

    // support for simnet is limited, in particular stx-account returns other values
    // .. therefore, delegate-stack-extend for a locked user fails
    // with an underflow error as stx-account unlock height and locked amount returns 0.
    // block.receipts[0].result.expectOk().expectUint(2_000_000);
    assertEquals(block.receipts.length, 0);

    // .. therefore, partial stacked amount for cycle 3 is none.
    // expectPartialStackedByCycle(poxAddrFP, 3, 2_000_000, chain, deployer);
    expectPartialStackedByCycle(poxAddrFP, 3, undefined, chain, deployer);
  },
});
