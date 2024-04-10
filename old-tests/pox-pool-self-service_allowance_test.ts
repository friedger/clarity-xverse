import { allowContractCaller } from "./client/pox-4-client.js";
import {
  delegateStx,
  fpDelegationAllowContractCaller,
} from "./client/pox-pool-self-service-client.ts";
import { Clarinet, Chain, Account, Tx, types } from "./deps.ts";
import { Errors, PoxErrors } from "./constants.ts";
import { expectTotalStackedByCycle } from "./utils.ts";

Clarinet.test({
  name: "Ensure that user can't delegate without allowance",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet_1 = accounts.get("wallet_1")!;

    // try without any allowance
    let block = chain.mineBlock([delegateStx(20_000_000_000_000, wallet_1)]);

    // check delegation calls
    block.receipts[0].result
      .expectErr()
      .expectUint(PoxErrors.StackingPermissionDenied * 1_000);
  },
});

Clarinet.test({
  name: "Ensure that user can only delegate from a contract with two allowances",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const helperDelegateStx = (amountUstx: number, user: Account) => {
      return Tx.contractCall(
        "helper",
        "delegate-stx",
        [types.uint(amountUstx)],
        user.address
      );
    };
    const deployer = accounts.get("deployer")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const wallet_2 = accounts.get("wallet_2")!;
    const poxPoolsSelfServiceContract =
      deployer.address + ".pox-pool-self-service";
    const helperContract = deployer.address + ".helper";

    // try without any allowance
    let block = chain.mineBlock([helperDelegateStx(20_000_000_000, wallet_1)]);
    block.receipts[0].result.expectErr().expectUint(609);

    // try with pox delegation allowance only
    block = chain.mineBlock([
      allowContractCaller(poxPoolsSelfServiceContract, undefined, wallet_1),
      helperDelegateStx(20_000_000_000_000, wallet_1),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result.expectErr().expectUint(609);

    // delegate-stx with all allowances
    block = chain.mineBlock([
      fpDelegationAllowContractCaller(helperContract, undefined, wallet_1),
      helperDelegateStx(20_000_000_000_000, wallet_1),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[1].result
      .expectOk()
      .expectTuple()
      ["commit-result"].expectBool(true);
    expectTotalStackedByCycle(1, 0, 19_999_999_000_000, chain, deployer);
  },
});
