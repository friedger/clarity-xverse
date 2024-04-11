import { tx } from "@hirosystems/clarinet-sdk";
import { Cl, ResponseOkCV, TupleCV, UIntCV } from "@stacks/transactions";
import { poxAddrCV } from "./pox-4-client";

export const POX_POOLS_1_CYCLE_CONTRACT_NAME = "pox-pools-1-cycle-v2";

export function poxDelegationAllowContractCaller(
  contractCaller: string,
  untilBurnHt: number | undefined,
  user: string
) {
  return simnet.callPublicFn(
    "pox-pools-1-cycle-v2",
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
    POX_POOLS_1_CYCLE_CONTRACT_NAME,
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
    "pox-pools-1-cycle-v2",
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
    "pox-pools-1-cycle-v2",
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
    "pox-pools-1-cycle-v2",
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
    "pox-pools-1-cycle-v2",
    "get-status-list",
    [Cl.principal(poolAddress), Cl.uint(cycle), Cl.uint(index)],
    user
  );
}

export function getTotal(poolAddress: string, cycle: number, user: string) {
  return simnet.callReadOnlyFn(
    "pox-pools-1-cycle-v2",
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
    "pox-pools-1-cycle-v2",
    "get-status",
    [Cl.principal(poolAddress), Cl.principal(userAddress), Cl.uint(cycle)],
    user
  );
}

export function getUserData(userAddress: string, user: string) {
  return simnet.callReadOnlyFn(
    "pox-pools-1-cycle-v2",
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
    "pox-pools-1-cycle-v2",
    "not-locked-for-cycle",
    [Cl.uint(unlockHeight), Cl.uint(cycleId)],
    user
  );
}
