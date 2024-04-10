import { allowContractCaller, getCycleLength } from "./client/pox-4-client.js";
import {
  delegateStx,
  delegateStackStxMany,
  setActive,
  setRewardAdmin,
  setStxBuffer,
  setPoolPoxAddress,
} from "./client/pox-pool-self-service-client.ts";
import { FpErrors, btcAddrWallet1, poxAddrFP } from "./constants.ts";
import { Clarinet, Chain, Account, assertEquals, Tx } from "./deps.ts";
import { expectPartialStackedByCycle } from "./utils.ts";

Clarinet.test({
  name: "Ensure that admin can deactivate contract",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const poxPoolSelfServiceContract =
      deployer.address + ".pox-pool-self-service";

    const { CYCLE, HALF_CYCLE } = await getCycleLength(chain);

    let block = chain.mineBlock([
      setActive(false, deployer),
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      delegateStx(20_000_000_000_000, wallet_1),
      delegateStackStxMany([wallet_1], deployer),
    ]);

    // check allow contract caller
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[2].result
      .expectErr()
      .expectUint(FpErrors.PoxAddressDeactivated);

    chain.mineEmptyBlock(HALF_CYCLE);

    block = chain.mineBlock([delegateStackStxMany([wallet_1], deployer)]);
    block.receipts[0].result
      .expectOk()
      .expectTuple()
      ["locking-result"].expectList()[0]
      .expectErr()
      .expectUint(FpErrors.PoxAddressDeactivated);
  },
});

Clarinet.test({
  name: "Ensure that non-admin cannot use admin functions",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    let block = chain.mineBlock([
      setActive(false, wallet_1),
      setRewardAdmin(wallet_1.address, true, wallet_1),
      setStxBuffer(1_000_000_000_000, wallet_1),
      setPoolPoxAddress(btcAddrWallet1, wallet_1),
    ]);

    assertEquals(block.receipts.length, 4);
    block.receipts.map((r: any) =>
      r.result.expectErr().expectUint(FpErrors.Unauthorized)
    );
  },
});

Clarinet.test({
  name: "Ensure that admin can set stx buffer",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const poxPoolSelfServiceContract =
      deployer.address + ".pox-pool-self-service";

    let block = chain.mineBlock([
      setStxBuffer(1_000, deployer),
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      delegateStx(10_000_000, wallet_1),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    expectPartialStackedByCycle(poxAddrFP, 1, 9_999_000, chain, deployer);
  },
});

Clarinet.test({
  name: "Ensure that admin can set pool address",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const poxPoolSelfServiceContract =
      deployer.address + ".pox-pool-self-service";

    let block = chain.mineBlock([
      setPoolPoxAddress(btcAddrWallet1, deployer),
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      delegateStx(10_000_000, wallet_1),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    expectPartialStackedByCycle(btcAddrWallet1, 1, 9_000_000, chain, deployer);
  },
});

Clarinet.test({
  name: "Ensure that there is always an admin",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    let block = chain.mineBlock([
      setRewardAdmin(deployer.address, false, deployer),
      setRewardAdmin(deployer.address, false, wallet_1),
      setRewardAdmin(wallet_1.address, true, deployer),
      setRewardAdmin(deployer.address, false, deployer),
      setRewardAdmin(deployer.address, false, wallet_1),
    ]);

    block.receipts[0].result.expectErr().expectUint(FpErrors.Forbidden);
    block.receipts[1].result.expectErr().expectUint(FpErrors.Unauthorized);
    block.receipts[2].result.expectOk().expectBool(true);
    block.receipts[3].result.expectErr().expectUint(FpErrors.Forbidden);
    block.receipts[4].result.expectOk().expectBool(true);
  },
});
