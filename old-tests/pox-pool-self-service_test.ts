import { allowContractCaller, getCycleLength } from "./client/pox-4-client.js";
import {
  delegateStackStx,
  delegateStx,
} from "./client/pox-pool-self-service-client.ts";
import { poxAddrFP } from "./constants.ts";
import { Account, Chain, Clarinet, assertEquals } from "./deps.ts";
import {
  expectPartialStackedByCycle,
  expectTotalStackedByCycle,
} from "./utils.ts";

Clarinet.test({
  name: "Ensure that users can delegate",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const poxPoolsSelfServiceContract =
      deployer.address + ".pox-pool-self-service";

    let block = chain.mineBlock([
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_1),
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_2),

      delegateStx(20_000_000_000_100, wallet_1),
      delegateStx(2_100_000, wallet_2),
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

    expectPartialStackedByCycle(poxAddrFP, 1, undefined, chain, deployer);
    expectTotalStackedByCycle(1, 0, 20_000_000_100_100, chain, deployer);
  },
});

Clarinet.test({
  name: "See that in simnet user can't increase amount for next cycle",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const poxPoolsSelfServiceContract =
      deployer.address + ".pox-pool-self-service";
    const { CYCLE } = await getCycleLength(chain);
    // current cycle is cycle 0

    // delegate 2 stx for cycle 1
    let block = chain.mineBlock([
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_1),
      delegateStx(2_000_000, wallet_1),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result
      .expectOk()
      .expectTuple()
      ["commit-result"].expectBool(false);
    console.log(block.receipts[1].events);

    expectPartialStackedByCycle(poxAddrFP, 1, 1_000_000, chain, deployer);
    expectTotalStackedByCycle(1, 0, undefined, chain, deployer);

    chain.mineEmptyBlock(CYCLE);

    // increase delegation to 3 stx for cycle 2
    block = chain.mineBlock([delegateStx(3_000_000, wallet_1)]);

    // support for simnet is limited, in particular stx-account returns other values
    // therefore, delegate-stack-extend fails with an underflow error
    // as stx-account unlock-height returns 0.
    // block.receipts[0].result.expectOk().expectUint(3_000_000);
    assertEquals(block.receipts.length, 0);
  },
});

Clarinet.test({
  name: "See that in simnet user can extend for next cycle for any user",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);
    const poxPoolsSelfServiceContract =
      deployer.address + ".pox-pool-self-service";

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
    // try to extend to cycle 2 early
    block = chain.mineBlock([delegateStackStx(wallet_1, wallet_2)]);
    assertEquals(block.receipts.length, 1);
    block.receipts[0].result.expectErr().expectUint(500); // too early
    assertEquals(block.height, CYCLE + HALF_CYCLE + 2);

    // extend to cycle 2
    block = chain.mineBlock([delegateStackStx(wallet_1, wallet_2)]);
    expectPartialStackedByCycle(poxAddrFP, 2, undefined, chain, deployer);

    // support for simnet is limited, in particular stx-account returns other values
    // .. therefore, delegate-stack-extend fails with an underflow error
    //  as stx-account unlock height returns 0.
    // block.receipts[0].result.expectOk().expectUint(2_000_000);
    assertEquals(block.receipts.length, 0);

    // .. therefore, partial stacked amount for cycle 2 is none.
    // expectPartialStackedByCycle(poxAddrFP, 2, 2_000_000, chain, deployer);
    expectPartialStackedByCycle(poxAddrFP, 2, undefined, chain, deployer);
  },
});
