import { getCycleLength } from "./client/pox-4-client.js";
import { Account, Chain, Clarinet, Tx, types } from "./deps.ts";

Clarinet.test({
  name: "Ensure that auto-extend-job does run with at least 1 user after half cycle passed",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    const { HALF_CYCLE } = await getCycleLength(chain);

    chain.mineEmptyBlock(HALF_CYCLE);

    let block = chain.mineBlock([
      Tx.contractCall(
        "fp-auto-extend",
        "set-users",
        [types.list([types.principal(wallet_1.address)])],
        deployer.address
      ),
      Tx.contractCall("fp-auto-extend", "run-job", [], deployer.address),
    ]);

    // verify results for run-job
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(true);
  },
});

Clarinet.test({
  name: "Ensure that auto-extend-job does not run too early",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    const { HALF_CYCLE } = await getCycleLength(chain);

    chain.mineEmptyBlock(HALF_CYCLE - 1);

    let block = chain.mineBlock([
      Tx.contractCall(
        "fp-auto-extend",
        "set-users",
        [types.list([types.principal(wallet_1.address)])],
        deployer.address
      ),
      Tx.contractCall("fp-auto-extend", "run-job", [], deployer.address),
    ]);

    // verify results for run-job
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectOk().expectBool(false);
  },
});

Clarinet.test({
  name: "Ensure that auto-extend-job does not run without at least 1 user",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    const { HALF_CYCLE } = await getCycleLength(chain);

    chain.mineEmptyBlock(HALF_CYCLE);

    let block = chain.mineBlock([
      Tx.contractCall("fp-auto-extend", "run-job", [], deployer.address),
    ]);

    // verify results for run-job
    block.receipts[0].result.expectOk().expectBool(false);
  },
});
