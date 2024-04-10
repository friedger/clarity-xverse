import { allowContractCaller, getCycleLength } from "./client/pox-4-client.js";
import { delegateStx } from "./client/pox-pool-self-service-client.ts";
import { Account, Chain, Clarinet, Tx, types } from "./deps.ts";

Clarinet.test({
  name: "Ensure that only reward admin can deposit rewards",
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

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
    const resultUser1 = block.receipts[2].result.expectOk().expectTuple();
    const resultUser2 = block.receipts[3].result.expectOk().expectTuple();

    resultUser1["commit-result"].expectBool(true);
    resultUser2["commit-result"].expectBool(true);
    resultUser1["lock-result"]
      .expectTuple()
      ["lock-amount"].expectUint(19_999_999_000_100);
    resultUser2["lock-result"]
      .expectTuple()
      ["lock-amount"].expectUint(1_100_000);

    const { CYCLE } = await getCycleLength(chain);
    chain.mineEmptyBlock(CYCLE);

    block = chain.mineBlock([
      // deposit during cycle 1
      Tx.contractCall(
        "payout-self-service",
        "deposit-rewards",
        [types.uint(100_000_000), types.uint(1)],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectErr().expectUint(ERR_TOO_EARLY);

    chain.mineEmptyBlock(CYCLE);

    block = chain.mineBlock([
      // wallet_1 deposits
      Tx.contractCall(
        "payout-self-service",
        "deposit-rewards",
        [types.uint(100_000_000), types.uint(1)],
        wallet_1.address
      ),
      // deposit for cycle 2
      Tx.contractCall(
        "payout-self-service",
        "deposit-rewards",
        [types.uint(100_000_000), types.uint(2)],
        deployer.address
      ),
      // correct deposit
      Tx.contractCall(
        "payout-self-service",
        "deposit-rewards",
        [types.uint(100_000_000), types.uint(1)],
        deployer.address
      ),
    ]);

    block.receipts[0].result.expectErr().expectUint(ERR_FORBIDDEN);
    block.receipts[1].result.expectErr().expectUint(ERR_NOT_FOUND);
    block.receipts[2].result.expectOk().expectUint(1);

    block = chain.mineBlock([
      // wallet_1 distributes
      Tx.contractCall(
        "payout-self-service",
        "distribute-rewards-many ",
        [
          types.list([
            types.principal(wallet_1.address),
            types.principal(wallet_2.address),
          ]),
          types.uint(1),
        ],
        wallet_1.address
      ),
      // wallet_1 distributes
      Tx.contractCall(
        "payout-self-service",
        "distribute-rewards-many ",
        [
          types.list([
            types.principal(wallet_1.address),
            types.principal(wallet_2.address),
          ]),
          types.uint(1),
        ],
        deployer.address
      ),
    ]);

    console.log(block.receipts[0].events);
    console.log(block.receipts[1].events);
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "Ensure that shares are calculated correctly",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    // 1%
    let response = chain.callReadOnlyFn(
      "payout-self-service",
      "calculate-share",
      [types.uint(100), types.uint(1_000_000), types.uint(100_000_000)],
      deployer.address
    );
    response.result.expectUint(1);

    // rounding down
    response = chain.callReadOnlyFn(
      "payout-self-service",
      "calculate-share",
      [types.uint(100), types.uint(3_333_333), types.uint(100_000_000)],
      deployer.address
    );
    response.result.expectUint(3);

    // rounding down
    response = chain.callReadOnlyFn(
      "payout-self-service",
      "calculate-share",
      [types.uint(100), types.uint(3_888_888), types.uint(100_000_000)],
      deployer.address
    );
    response.result.expectUint(3);

    // rounding down
    response = chain.callReadOnlyFn(
      "payout-self-service",
      "calculate-share",
      [types.uint(100), types.uint(888_888), types.uint(100_000_000)],
      deployer.address
    );
    response.result.expectUint(0);
  },
});

const ERR_FORBIDDEN = 403;
const ERR_NOT_FOUND = 404;
const ERR_TOO_EARLY = 500;
const ERR_INSUFFICIENT_FUNDS = 501;
const ERR_UNEXPECTED = 999;
