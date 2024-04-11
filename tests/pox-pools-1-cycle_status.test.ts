import { hexToBytes } from "@stacks/common";
import {
  BufferCV,
  Cl,
  ClarityType,
  SomeCV,
  TupleCV,
  createStacksPrivateKey,
  createStacksPublicKey,
  pubKeyfromPrivKey,
  publicKeyToString,
} from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import {
  allowContractCaller,
  poxAddrCV,
  stackAggregationCommitIndexed,
} from "./client/pox-4-client.js";
import {
  POX_POOLS_1_CYCLE_CONTRACT_NAME,
  StatusResponseOKCV,
  delegateStackStx,
  delegateStx,
  getNotLockedForCycle,
  getStatus,
  getUserData,
} from "./client/pox-pools-1-cycle-client.ts";
import {
  Errors,
  PoxErrors,
  btcAddrWallet1,
  btcAddrWallet2,
  poxAddrPool1,
} from "./constants.ts";
import {
  Pox4SignatureTopic,
  poxAddressToBtcAddress,
  signPox4SignatureHash,
} from "@stacks/stacking";
import { StacksTestnet } from "@stacks/network";

const accounts = simnet.getAccounts();
let wallet_1 = accounts.get("wallet_1")!;
let wallet_2 = accounts.get("wallet_2")!;
let pool_1 = accounts.get("deployer")!;
let pool_2 = accounts.get("wallet_8")!;
const poxPools1CycleContract = pool_1 + "." + POX_POOLS_1_CYCLE_CONTRACT_NAME;

describe(POX_POOLS_1_CYCLE_CONTRACT_NAME + " Status", () => {
  it("Ensure that getStatus returns correct values", () => {
    // info before delegation
    let response = getStatus(pool_1, wallet_1, 1, wallet_1);
    expect(response.result).toBeErr(Cl.uint(Errors.NoStackerInfo));

    response = getUserData(wallet_1, wallet_1);
    expect(response.result).toBeNone();

    let block = simnet.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_2),
      allowContractCaller(poxPools1CycleContract, undefined, pool_1),

      delegateStx(
        100_000_000,
        pool_1,
        undefined,
        undefined,
        btcAddrWallet1,
        wallet_1
      ),
      delegateStx(
        10_000_000_000_000,
        pool_1,
        undefined,
        undefined,
        btcAddrWallet2,
        wallet_2
      ),
    ]);
    expect(block[0].result).toBeOk(Cl.bool(true));
    expect(block[1].result).toBeOk(Cl.bool(true));
    expect(block[2].result).toBeOk(Cl.bool(true));
    expect(block[3].result).toBeOk(Cl.bool(true));
    expect(block[4].result).toBeOk(Cl.bool(true));

    // info before stacking
    response = getStatus(pool_1, wallet_1, 1, wallet_1);
    expect(response.result).toBeErr(Cl.uint(Errors.NoStackerInfo));

    response = getUserData(wallet_1, wallet_1);
    expect(response.result).toBeSome(
      Cl.tuple({
        ["pox-addr"]: poxAddrCV({
          version: "0x01",
          hashbytes: "000102030405060708090a0b0c0d0e0f00010203",
        }),
        cycle: Cl.uint(0),
      })
    );

    block = simnet.mineBlock([
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 100_000_000,
          },
        ],
        poxAddrPool1,
        40,
        pool_1
      ),
    ]);
    expect(block[0].result).toBeOk(
      Cl.list([
        Cl.ok(
          Cl.tuple({
            "lock-amount": Cl.uint(100_000_000),
            stacker: Cl.principal(wallet_1),
            "unlock-burn-height": Cl.uint(2100),
          })
        ),
      ])
    );

    response = getStatus(pool_1, wallet_1, 1, wallet_1);
    expect(response.result).toBeOk(expect.anything());
    let info = (response.result as StatusResponseOKCV).value.data;
    expect(info["stacker-info"].type).toBe(ClarityType.Tuple);
    expect(info["user-info"].type).toBe(ClarityType.Tuple);
    expect(info["total"]).toBeUint(100_000_000);

    response = getUserData(wallet_1, wallet_1);
    expect(response.result).toBeSome(
      Cl.tuple({
        ["pox-addr"]: poxAddrCV({
          version: "0x01",
          hashbytes: "000102030405060708090a0b0c0d0e0f00010203",
        }),
        cycle: Cl.uint(0),
      })
    );
    expect(
      (
        response.result as SomeCV<
          TupleCV<{
            "pox-addr": TupleCV<{ hashbytes: BufferCV; version: BufferCV }>;
          }>
        >
      ).value.data["pox-addr"].data.hashbytes
    ).toBeBuff(hexToBytes("000102030405060708090a0b0c0d0e0f00010203"));

    // status after commit
    const authId = 1;
    const maxAmount = 100_000_000;
    const period = 1;
    const rewardCycle = 1;
    const privateKey = createStacksPrivateKey(
      "753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601"
    );
    block = simnet.mineBlock([
      stackAggregationCommitIndexed(
        poxAddrPool1,
        period,
        signPox4SignatureHash({
          topic: Pox4SignatureTopic.AggregateCommit,
          authId,
          maxAmount,
          period,
          network: new StacksTestnet(),
          poxAddress: poxAddressToBtcAddress(
            hexToBytes(poxAddrPool1.version.substring(2))[0],
            hexToBytes(poxAddrPool1.hashbytes.substring(2)),
            "testnet"
          ),
          rewardCycle,
          privateKey,
        }),
        publicKeyToString(
          pubKeyfromPrivKey(
            "753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601"
          )
        ),
        maxAmount,
        authId,
        pool_1
      ),
    ]);
    expect(block[0].result).toBeErr(Cl.int(PoxErrors.StackingThresholdNotMet));

    response = getStatus(pool_1, wallet_1, 1, wallet_1);
    expect(response.result).toBeOk(expect.anything());
    info = (response.result as StatusResponseOKCV).value.data;
    expect(info["stacker-info"].type).toBe(ClarityType.Tuple);
    expect(info["user-info"].type).toBe(ClarityType.Tuple);
    expect(info["total"]).toBeUint(100_000_000);

    response = getUserData(wallet_1, wallet_1);
    expect(response.result).toBeSome(
      Cl.tuple({
        ["pox-addr"]: poxAddrCV({
          version: "0x01",
          hashbytes: "000102030405060708090a0b0c0d0e0f00010203",
        }),
        cycle: Cl.uint(0),
      })
    );

    // get status with wrong pool address
    response = getStatus(pool_2, wallet_1, 1, wallet_1);
    expect(response.result).toBeOk(expect.anything());
    info = (response.result as StatusResponseOKCV).value.data;
    expect(info["total"]).toBeUint(0);

    response = getUserData(wallet_1, wallet_1);
    expect(response.result).toBeSome(
      Cl.tuple({
        ["pox-addr"]: poxAddrCV({
          version: "0x01",
          hashbytes: "000102030405060708090a0b0c0d0e0f00010203",
        }),
        cycle: Cl.uint(0),
      })
    );
  });

  it("Ensure that unlock height checks are correct", () => {
    let response = getNotLockedForCycle(10, 1, wallet_1);
    expect(response.result).toBeBool(true);
    response = getNotLockedForCycle(1050, 1, wallet_1);
    expect(response.result).toBeBool(true);
    response = getNotLockedForCycle(1051, 1, wallet_1);
    expect(response.result).toBeBool(false);
    response = getNotLockedForCycle(2100, 1, wallet_1);
    expect(response.result).toBeBool(false);
    response = getNotLockedForCycle(2100, 2, wallet_1);
    expect(response.result).toBeBool(true);
    response = getNotLockedForCycle(2101, 2, wallet_1);
    expect(response.result).toBeBool(false);
  });
});
