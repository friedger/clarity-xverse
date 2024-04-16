import { tx } from "@hirosystems/clarinet-sdk";
import {
  Cl,
  ClarityType,
  ClarityValue,
  ListCV,
  OptionalCV,
  ResponseOkCV,
  TupleCV,
  UIntCV,
} from "@stacks/transactions";
import { poxAddrCV } from "./pox-4-client";
import { expect } from "vitest";

export const POX4_POOLS = "pox4-pools";
export const poxPools1CycleContract =
  simnet.getAccounts().get("deployer")!! + "." + POX4_POOLS;

export function poxDelegationAllowContractCaller(
  contractCaller: string,
  untilBurnHt: number | undefined,
  user: string
) {
  return simnet.callPublicFn(
    POX4_POOLS,
    "allow-contract-caller",
    [
      Cl.principal(contractCaller),
      untilBurnHt ? Cl.some(Cl.uint(untilBurnHt)) : Cl.none(),
    ],
    user
  );
}

export function delegateStx(
  amount: number,
  poolAddress: string,
  untilBurnHt: number | undefined,
  poolPoxAddr: { version: string; hashbytes: string } | undefined,
  userPoxAddr: { version: string; hashbytes: string },
  caller: string
) {
  return tx.callPublicFn(
    POX4_POOLS,
    "delegate-stx",
    [
      Cl.uint(amount),
      Cl.principal(poolAddress),
      untilBurnHt ? Cl.some(Cl.uint(untilBurnHt)) : Cl.none(),
      poolPoxAddr ? Cl.some(poxAddrCV(poolPoxAddr)) : Cl.none(),
      poxAddrCV(userPoxAddr),
      Cl.none(),
    ],
    caller
  );
}

export function delegateStackStx(
  members: { user: string; amountUstx: number }[],
  poolPoxAddr: { version: string; hashbytes: string },
  startBurnHt: number,
  poolOperator: string
) {
  return tx.callPublicFn(
    POX4_POOLS,
    "delegate-stack-stx",
    [
      Cl.list(
        members.map((m) =>
          Cl.tuple({
            user: Cl.principal(m.user),
            "amount-ustx": Cl.uint(m.amountUstx),
          })
        )
      ),

      poxAddrCV(poolPoxAddr),
      Cl.uint(startBurnHt),
    ],
    poolOperator
  );
}

export function delegateStackStxSimple(
  members: string[],
  poolPoxAddr: { version: string; hashbytes: string },
  startBurnHt: number,
  poolOperator: string
) {
  return tx.callPublicFn(
    POX4_POOLS,
    "delegate-stack-stx-simple",
    [
      Cl.list(members.map((u) => Cl.principal(u))),
      poxAddrCV(poolPoxAddr),
      Cl.uint(startBurnHt),
    ],
    poolOperator
  );
}
export function getStatusListsLastIndex(
  poolAddress: string,
  cycle: number,
  user: string
) {
  return simnet.callReadOnlyFn(
    POX4_POOLS,
    "get-status-lists-last-index",
    [Cl.principal(poolAddress), Cl.uint(cycle)],
    user
  );
}

export function getStatusList(
  poolAddress: string,
  cycle: number,
  index: number,
  user: string
) {
  return simnet.callReadOnlyFn(
    POX4_POOLS,
    "get-status-list",
    [Cl.principal(poolAddress), Cl.uint(cycle), Cl.uint(index)],
    user
  );
}

export function expectStatusListNone(result: ClarityValue) {
  let statusList = result as TupleCV<{
    "status-list": OptionalCV<ListCV>;
  }>;
  expect(statusList.data["status-list"]).toBeNone();
}

export function getTotal(poolAddress: string, cycle: number, user: string) {
  return simnet.callReadOnlyFn(
    POX4_POOLS,
    "get-total",
    [Cl.principal(poolAddress), Cl.uint(cycle)],
    user
  );
}

export interface StatusResponseOKCV
  extends ResponseOkCV<
    TupleCV<{
      "stacker-info": TupleCV<any>;
      "user-info": TupleCV<any>;
      total: UIntCV;
    }>
  > {}

export function getStatus(
  poolAddress: string,
  userAddress: string,
  cycle: number,
  user: string
) {
  return simnet.callReadOnlyFn(
    POX4_POOLS,
    "get-status",
    [Cl.principal(poolAddress), Cl.principal(userAddress), Cl.uint(cycle)],
    user
  );
}

export function expectOkStatus(
  result: ClarityValue,
  expectedStatus: {
    stackerInfo: {
      firstRewardCycle: number;
    };
    userInfo: {
      hashbytes: string;
      version: string;
      cycle: number;
      total: number;
    };
  }
) {
  expect(result).toHaveClarityType(ClarityType.ResponseOk);
  let info = (result as StatusResponseOKCV).value.data;
  expect(info["stacker-info"].data["first-reward-cycle"]).toBeUint(
    expectedStatus.stackerInfo.firstRewardCycle
  );
  expect(info["user-info"].data.cycle).toBeUint(expectedStatus.userInfo.cycle);
  expect(info["user-info"].data["pox-addr"]).toBeTuple(
    poxAddrCV({
      hashbytes: expectedStatus.userInfo.hashbytes,
      version: expectedStatus.userInfo.version,
    }).data
  );
  expect(info["total"]).toBeUint(expectedStatus.userInfo.total);
}

export function getUserData(userAddress: string, user: string) {
  return simnet.callReadOnlyFn(
    POX4_POOLS,
    "get-user-data",
    [Cl.principal(userAddress)],
    user
  );
}

export function getNotLockedForCycle(
  unlockHeight: number,
  cycleId: number,
  user: string
) {
  return simnet.callReadOnlyFn(
    POX4_POOLS,
    "not-locked-for-cycle",
    [Cl.uint(unlockHeight), Cl.uint(cycleId)],
    user
  );
}
