import {
  DevnetNetworkOrchestrator,
  StacksBlockMetadata,
} from "@hirosystems/stacks-devnet-js";
import { StacksTestnet } from "@stacks/network";
import { Accounts } from "./constants";
import {
  asyncExpectCurrentCycleIdToBe,
  buildDevnetNetworkOrchestrator,
  deployContract,
  FAST_FORWARD_TO_EPOCH_2_4,
  getNetworkIdFromEnv,
  getPoxInfo,
  waitForRewardCycleId,
  waitForStacksTransaction,
} from "./helpers";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { broadcastAllowContractCallerContracCallPool1Cycle } from "./allowContractCaller";
import {
  broadcastDelegateStackStx,
  broadcastDelegateStx,
} from "./helper-1-cycle";
import {
  cvToString,
  falseCV,
  responseOkCV,
  trueCV,
} from "@stacks/transactions";
import { readFileSync } from "fs";

describe("testing stacking for pox-pool-1-cycle", () => {
  let orchestrator: DevnetNetworkOrchestrator;
  const timeline = FAST_FORWARD_TO_EPOCH_2_4;
  let aliceNonce = 0;
  let bobNonce = 0;
  let deployerNonce = 0;

  beforeAll(() => {
    orchestrator = buildDevnetNetworkOrchestrator(
      getNetworkIdFromEnv(),
      timeline
    );
    orchestrator.start(1000);
  });

  afterAll(() => {
    orchestrator.terminate();
  });

  it("user can delegate with 1-cycle pool, pool operator can lock (cycle #2)", async () => {
    const network = new StacksTestnet({ url: orchestrator.getStacksNodeUrl() });

    await waitForStacks24AndDeployContract(orchestrator, timeline, network);

    await asyncExpectCurrentCycleIdToBe(2, network);

    // allow contract fast pool contract to manage stacking
    let response = await broadcastAllowContractCallerContracCallPool1Cycle({
      network,
      nonce: aliceNonce++,
      senderKey: Accounts.WALLET_1.secretKey,
    });
    expect(
      response.error,
      `${response.reason_data} - ${response.reason}`
    ).toBeUndefined();
    let [block, tx] = await waitForStacksTransaction(
      orchestrator,
      response.txid
    );
    expect(tx.success).toBeTruthy();

    // Alice delegates 10m STX to Chloe
    response = await broadcastDelegateStx({
      amountUstx: 10_000_000_000,
      user: Accounts.WALLET_1,
      delegateTo: Accounts.WALLET_3.stxAddress,
      userPoxAddr: Accounts.WALLET_1.btcAddress,
      nonce: aliceNonce++,
      network,
    });
    expect(response.error, response.reason).toBeUndefined();
    console.log(response.txid);
    [block, tx] = await waitForStacksTransaction(
      orchestrator,
      response.txid
    );
    expect(tx.success).toBeTruthy();

    // Chloe locks Alice 10m STX
    response = await broadcastDelegateStackStx({
      stacker: Accounts.WALLET_1,
      amountUstx: 10_000_000_000,
      user: Accounts.WALLET_3,
      nonce: aliceNonce++,
      network,
    });
    expect(response.error, response.reason).toBeUndefined();
    console.log("delegate-stack-stx submitted");
    [block, tx] = await waitForStacksTransaction(orchestrator, response.txid);
    expect(tx.success).toBeTruthy();
  });

  it("user can increase delegation, pool operator can extend and increase (cycle #3)", async () => {
    const network = new StacksTestnet({ url: orchestrator.getStacksNodeUrl() });

    await waitForRewardCycleId(network, orchestrator, 3);
    let chainUpdate = await orchestrator.waitForNextStacksBlock();
    console.log(
      "** btc block: " +
        (chainUpdate.new_blocks[0].block.metadata as StacksBlockMetadata)
          .bitcoin_anchor_block_identifier.index
    );
    // wait for another block
    chainUpdate = await orchestrator.waitForNextStacksBlock();

    await asyncExpectCurrentCycleIdToBe(2, network);

    // Alice delegates 11m STX to Chloe
    let response = await broadcastDelegateStx({
      amountUstx: 11_000_000_000,
      user: Accounts.WALLET_1,
      delegateTo: Accounts.WALLET_3.stxAddress,
      userPoxAddr: Accounts.WALLET_1.btcAddress,
      nonce: aliceNonce++,
      network,
    });
    expect(response.error).toBeUndefined();
    console.log("delegate 11m submitted");
    let [block, tx] = await waitForStacksTransaction(
      orchestrator,
      response.txid
    );
    expect(tx.success).toBeTruthy();
    expect(tx.result).toBe(cvToString(responseOkCV(falseCV())));

    // Chloe locks Alice 10m STX
    response = await broadcastDelegateStackStx({
      stacker: Accounts.WALLET_1,
      amountUstx: 10_000_000_000,
      user: Accounts.WALLET_3,
      nonce: aliceNonce++,
      network,
    });
    expect(response.error, response.reason).toBeUndefined();
    [block, tx] = await waitForStacksTransaction(orchestrator, response.txid);
    expect(tx.success).toBeTruthy();
  });

  it("user can delegate with 1-cycle pool, pool operator can lock (cycle #4)", async () => {
    const network = new StacksTestnet({ url: orchestrator.getStacksNodeUrl() });

    await waitForRewardCycleId(network, orchestrator, 4);

    let chainUpdate = await orchestrator.waitForNextStacksBlock();
    console.log(
      "** " +
        (chainUpdate.new_blocks[0].block.metadata as StacksBlockMetadata)
          .bitcoin_anchor_block_identifier.index
    );
    console.log(JSON.stringify(chainUpdate));

    await asyncExpectCurrentCycleIdToBe(3, network);

    // wait for another block
    chainUpdate = await orchestrator.waitForNextStacksBlock();
    // Chloe extends Alice's locked STX
    let response = await broadcastDelegateStackStx({
      stacker: Accounts.WALLET_1,
      amountUstx: 11_000_000_000,
      user: Accounts.WALLET_3,
      nonce: bobNonce++,
      network,
    });
    expect(response.error).toBeUndefined();
    let [block, tx] = await waitForStacksTransaction(
      orchestrator,
      response.txid
    );
    expect(tx.success).toBeTruthy();
    expect(tx.result).toBe(cvToString(responseOkCV(falseCV())));
  });
});

async function waitForStacks24AndDeployContract(
  orchestrator: DevnetNetworkOrchestrator,
  timeline: {
    epoch_2_0: number;
    epoch_2_05: number;
    epoch_2_1: number;
    pox_2_activation: number;
    epoch_2_2: number;
    epoch_2_3: number;
    epoch_2_4: number;
  },
  network: StacksTestnet
) {
  // Wait for 2.4 to go live
  await orchestrator.waitForStacksBlockAnchoredOnBitcoinBlockOfHeight(
    timeline.epoch_2_4
  );
  // let { response } = await deployContract(
  //   network,
  //   Accounts.DEPLOYER,
  //   0,
  //   "pox-pools-1-cycle",
  //   readFileSync("./contracts/pox-pools-1-cycle.clar").toString()
  // );
  // let [block, tx] = await waitForStacksTransaction(orchestrator, response.txid);
  // expect(tx.success, tx.result).toBeTruthy();
}
