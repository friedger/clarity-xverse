import {
  DevnetNetworkOrchestrator,
  StacksBlockMetadata,
} from "@hirosystems/stacks-devnet-js";
import { StacksNetwork, StacksTestnet } from "@stacks/network";
import { Accounts } from "./constants";
import {
  Epoch24Timeline,
  FAST_FORWARD_TO_EPOCH_2_4,
  asyncExpectCurrentCycleIdToBe,
  buildDevnetNetworkOrchestrator,
  deployContract,
  getNetworkIdFromEnv,
  getPoxInfo,
  waitForRewardCycleId,
  waitForStacksTransaction,
} from "./helpers";

import { cvToString, falseCV, responseOkCV } from "@stacks/transactions";
import { readFileSync } from "fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { broadcastAllowContractCallerContracCallPool1Cycle } from "./allowContractCaller";
import { broadcastDelegateStackStx, broadcastDelegateStx } from "./helper-fp";

describe("testing stacking for pox-pool-self-service", () => {
  let orchestrator: DevnetNetworkOrchestrator;
  const timeline = FAST_FORWARD_TO_EPOCH_2_4;
  let aliceNonce = 0;
  let bobNonce = 0;
  let chloeNonce = 0;

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

  it("user can delegateStx with fp for one cycle (cycle #1)", async () => {
    const network = new StacksTestnet({ url: orchestrator.getStacksNodeUrl() });

    await waitForStacks24AndDeployContract(orchestrator, timeline, network);

    await asyncExpectCurrentCycleIdToBe(1, network)

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

    // Alice delegates 10m STX
    response = await broadcastDelegateStx({
      amountUstx: 10_000_000_000,
      user: Accounts.WALLET_1,
      nonce: aliceNonce++,
      network,
    });
    expect(response.error, response.reason).toBeUndefined();
    let [block, tx] = await waitForStacksTransaction(
      orchestrator,
      response.txid
    );
    expect(tx.success).toBeTruthy();
    expect(tx.result).toBe(cvToString(responseOkCV(falseCV())));
  })

  it("user can extend and increase (cycle #3)", async () => {
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

    // Alice delegates 11m STX
    let response = await broadcastDelegateStx({
      amountUstx: 11_000_000_000,
      user: Accounts.WALLET_1,
      nonce: aliceNonce++,
      network,
    });
    expect(response.error).toBeUndefined();
    console.log("delegate 11m submitted");
    let [block, tx] = await waitForStacksTransaction(orchestrator, response.txid);
    expect(tx.success).toBeTruthy();
    expect(tx.result).toBe(cvToString(responseOkCV(falseCV())));

  })

  it("other user can extend only after half of the cycle (cycle #3)", async () => {
    const network = new StacksTestnet({ url: orchestrator.getStacksNodeUrl() });

    await waitForRewardCycleId(network, orchestrator, 3);

    let chainUpdate = await orchestrator.waitForNextStacksBlock();
    console.log(
      "** " +
        (chainUpdate.new_blocks[0].block.metadata as StacksBlockMetadata)
          .bitcoin_anchor_block_identifier.index
    );
    console.log(JSON.stringify(chainUpdate));

    asyncExpectCurrentCycleIdToBe(3, network);

    // wait for another block
    chainUpdate = await orchestrator.waitForNextStacksBlock();
    // Bob extends Alice's locked STX
    let response = await broadcastDelegateStackStx({
      stacker: Accounts.WALLET_1,
      user: Accounts.WALLET_2,
      nonce: bobNonce++,
      network,
    });
    expect(response.error).toBeUndefined();
    let [block, tx] = await waitForStacksTransaction(orchestrator, response.txid);
    expect(tx.success).toBeTruthy();
    expect(tx.result).toBe(cvToString(responseOkCV(falseCV())));
  });
});

async function waitForStacks24AndDeployContract(
  orchestrator: DevnetNetworkOrchestrator,
  timeline: Epoch24Timeline,
  network: StacksNetwork
) {
  // Wait for 2.4 to go live
  await orchestrator.waitForStacksBlockAnchoredOnBitcoinBlockOfHeight(
    timeline.epoch_2_4
  );

  // // deploy contract
  // let { response } = await deployContract(
  //   network,
  //   Accounts.DEPLOYER,
  //   0,
  //   "pox-pool-self-service",
  //   readFileSync("./contracts/pox-pool-self-service.clar").toString()
  // );
  // let [block, tx] = await waitForStacksTransaction(orchestrator, response.txid);
  // expect(tx.success, tx.result).toBeTruthy();

}
