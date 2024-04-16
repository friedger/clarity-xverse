import { tx } from "@hirosystems/clarinet-sdk";
import { hexToBytes } from "@stacks/common";
import { StacksTestnet } from "@stacks/network";
import {
  Pox4SignatureTopic,
  poxAddressToBtcAddress,
  signPox4SignatureHash,
} from "@stacks/stacking";
import {
  Cl,
  createStacksPrivateKey,
  cvToString,
  pubKeyfromPrivKey,
  publicKeyToString,
} from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import {
  allowContractCaller,
  getCycleLength,
  stackAggregationCommitIndexed,
} from "./client/pox-4-client.js";
import {
  delegateStx,
  maybeStackAggregationCommit,
  poxPoolSelfServiceContract,
} from "./client/pox-pool-self-service-client.ts";
import { poxAddrFP, poxAddrPool1 } from "./constants.ts";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const wallet_2 = accounts.get("wallet_2")!;

describe("payout-self-service", () => {
  it("Ensure that only reward admin can deposit rewards", () => {
    const { CYCLE } = getCycleLength();

    let privateKey =
      "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801"; // private key wallet_1
    let signerKey = publicKeyToString(pubKeyfromPrivKey(privateKey));
    let maxAmount = 100_000_000_000_000;
    let authId = 1;
    let period = 1;
    let rewardCycle = 1;
    let poxAddress = poxAddressToBtcAddress(
      hexToBytes(poxAddrFP.version.substring(2))[0],
      hexToBytes(poxAddrFP.hashbytes.substring(2)),
      "testnet"
    );

    let block = simnet.mineBlock([
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_1),
      allowContractCaller(poxPoolSelfServiceContract, undefined, wallet_2),

      delegateStx(20_000_000_000_100, wallet_1),
      delegateStx(2_100_000, wallet_2),
      maybeStackAggregationCommit(
        rewardCycle - 1,
        signPox4SignatureHash({
          topic: Pox4SignatureTopic.AggregateCommit,
          period,
          rewardCycle,
          maxAmount,
          network: new StacksTestnet(),
          poxAddress,
          authId,
          privateKey: createStacksPrivateKey(privateKey),
        }),
        signerKey,
        maxAmount,
        authId,
        deployer
      ),
    ]);

    expect(block[0].result).toBeOk(Cl.bool(true));
    expect(block[1].result).toBeOk(Cl.bool(true));

    expect(block[2].result).toBeOk(
      Cl.tuple({
        "lock-amount": Cl.uint(19_999_999_000_100),
        stacker: Cl.principal(wallet_1),
        "unlock-burn-height": Cl.uint(2 * CYCLE),
      })
    );
    expect(block[3].result).toBeOk(
      Cl.tuple({
        "lock-amount": Cl.uint(1_100_000),
        stacker: Cl.principal(wallet_2),
        "unlock-burn-height": Cl.uint(2 * CYCLE),
      })
    );
    expect(block[4].result).toBeOk(Cl.bool(true));

    simnet.mineEmptyBlocks(CYCLE);

    block = simnet.mineBlock([
      // deposit during cycle 1
      tx.callPublicFn(
        "payout-self-service",
        "deposit-rewards",
        [Cl.uint(100_000_000), Cl.uint(1)],
        deployer
      ),
    ]);
    expect(block[0].result).toBeErr(Cl.uint(ERR_TOO_EARLY));

    simnet.mineEmptyBlocks(CYCLE);

    block = simnet.mineBlock([
      // wallet_1 deposits
      tx.callPublicFn(
        "payout-self-service",
        "deposit-rewards",
        [Cl.uint(100_000_000), Cl.uint(1)],
        wallet_1
      ),
      // deposit for cycle 2
      tx.callPublicFn(
        "payout-self-service",
        "deposit-rewards",
        [Cl.uint(100_000_000), Cl.uint(2)],
        deployer
      ),
      // correct deposit
      tx.callPublicFn(
        "payout-self-service",
        "deposit-rewards",
        [Cl.uint(100_000_000), Cl.uint(1)],
        deployer
      ),
    ]);

    expect(block[0].result).toBeErr(Cl.uint(ERR_FORBIDDEN));
    expect(block[1].result).toBeErr(Cl.uint(ERR_NOT_FOUND));
    expect(block[2].result).toBeOk(Cl.uint(1));

    block = simnet.mineBlock([
      // wallet_1 distributes
      tx.callPublicFn(
        "payout-self-service",
        "distribute-rewards-many",
        [Cl.list([Cl.principal(wallet_1), Cl.principal(wallet_2)]), Cl.uint(1)],
        wallet_1
      ),
      // deployer distributes
      tx.callPublicFn(
        "payout-self-service",
        "distribute-rewards-many",
        [Cl.list([Cl.principal(wallet_1), Cl.principal(wallet_2)]), Cl.uint(1)],
        deployer
      ),
    ]);

    expect(block[0].result).toBeOk(Cl.bool(true));
    expect(block[1].result).toBeErr(Cl.uint(ERR_INSUFFICIENT_FUNDS));
  });

  it("Ensure that shares are calculated correctly", () => {
    const deployer = accounts.get("deployer")!;
    // 1%
    let response = simnet.callReadOnlyFn(
      "payout-self-service",
      "calculate-share",
      [Cl.uint(100), Cl.uint(1_000_000), Cl.uint(100_000_000)],
      deployer
    );
    expect(response.result).toBeUint(1);

    // rounding down
    response = simnet.callReadOnlyFn(
      "payout-self-service",
      "calculate-share",
      [Cl.uint(100), Cl.uint(3_333_333), Cl.uint(100_000_000)],
      deployer
    );
    expect(response.result).toBeUint(3);

    // rounding down
    response = simnet.callReadOnlyFn(
      "payout-self-service",
      "calculate-share",
      [Cl.uint(100), Cl.uint(3_888_888), Cl.uint(100_000_000)],
      deployer
    );
    expect(response.result).toBeUint(3);

    // rounding down
    response = simnet.callReadOnlyFn(
      "payout-self-service",
      "calculate-share",
      [Cl.uint(100), Cl.uint(888_888), Cl.uint(100_000_000)],
      deployer
    );
    expect(response.result).toBeUint(0);
  });
});

const ERR_FORBIDDEN = 403;
const ERR_NOT_FOUND = 404;
const ERR_TOO_EARLY = 500;
const ERR_INSUFFICIENT_FUNDS = 501;
const ERR_UNEXPECTED = 999;
