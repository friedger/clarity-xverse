import { tx } from "@hirosystems/clarinet-sdk";
import {
  Cl,
  ClarityType,
  ResponseOkCV,
  TupleCV,
  UIntCV,
  cvToString,
} from "@stacks/transactions";
import { expect } from "vitest";

const user = {
  address: "ST000000000000000000002AMW42H",
};

export function allowContractCaller(
  contractCaller: string,
  untilBurnHt: number | undefined,
  user: string
) {
  return tx.callPublicFn(
    "ST000000000000000000002AMW42H.pox-4",
    "allow-contract-caller",
    [
      Cl.principal(contractCaller),
      untilBurnHt ? Cl.some(Cl.uint(untilBurnHt)) : Cl.none(),
    ],
    user
  );
}

export function delegateStx(amount: number, delegateTo: string, user: string) {
  return tx.callPublicFn(
    "ST000000000000000000002AMW42H.pox-4",
    "delegate-stx",
    [Cl.uint(amount), Cl.principal(delegateTo), Cl.none(), Cl.none()],
    user
  );
}

export function delegateStackExtend(
  stacker: string,
  poxAddr: { version: string; hashbytes: string },
  extendedCount: number,
  user: string
) {
  return tx.callPublicFn(
    "ST000000000000000000002AMW42H.pox-4",
    "delegate-stack-extend",
    [Cl.principal(stacker), poxAddrCV(poxAddr), Cl.uint(extendedCount)],
    user
  );
}

export function stackAggregationCommitIndexed(
  poxAddr: { version: string; hashbytes: string },
  cycle: number,
  signature: string,
  signerKey: string,
  maxAmount: number,
  authId: number,
  poolOperator: string
) {
  return tx.callPublicFn(
    "ST000000000000000000002AMW42H.pox-4",
    "stack-aggregation-commit-indexed",
    [
      poxAddrCV(poxAddr),
      Cl.uint(cycle),
      signature ? Cl.some(Cl.bufferFromHex(signature)) : Cl.none(),
      Cl.bufferFromHex(signerKey),
      Cl.uint(maxAmount),
      Cl.uint(authId),
    ],
    poolOperator
  );
}

export function stackAggregationIncrease(
  poxAddr: { version: string; hashbytes: string },
  cycle: number,
  poxAddrIndex: number,
  signature: string,
  signerKey: string,
  maxAmount: number,
  authId: number,
  poolOperator: string
) {
  return tx.callPublicFn(
    "ST000000000000000000002AMW42H.pox-4",
    "stack-aggregation-increase",
    [
      poxAddrCV(poxAddr),
      Cl.uint(cycle),
      Cl.uint(poxAddrIndex),
      signature ? Cl.some(Cl.bufferFromHex(signature)) : Cl.none(),
      Cl.bufferFromHex(signerKey),
      Cl.uint(maxAmount),
      Cl.uint(authId),
    ],
    poolOperator
  );
}

export function revokeDelegateStx(user: string) {
  return tx.callPublicFn(
    "ST000000000000000000002AMW42H.pox-4",
    "revoke-delegate-stx",
    [],
    user
  );
}

export function getPartialStackedByCycle(
  poolPoxAddr: { version: string; hashbytes: string },
  cycle: number,
  poolAddress: string,
  user: string
) {
  return simnet.callReadOnlyFn(
    "ST000000000000000000002AMW42H.pox-4",
    "get-partial-stacked-by-cycle",
    [poxAddrCV(poolPoxAddr), Cl.uint(cycle), Cl.principal(poolAddress)],
    user
  );
}

export function getRewardSetPoxAddress(
  cycle: number,
  index: number,
  user: string
) {
  return simnet.callReadOnlyFn(
    "ST000000000000000000002AMW42H.pox-4",
    "get-reward-set-pox-address",
    [Cl.uint(cycle), Cl.uint(index)],
    user
  );
}

export function getPoxInfo(user: string) {
  return simnet.callReadOnlyFn(
    "ST000000000000000000002AMW42H.pox-4",
    "get-pox-info",
    [],
    user
  );
}

export function asyncExpectCurrentCycle(cycle: number) {
  const poxInfoResponse = getPoxInfo(user.address);
  expect(poxInfoResponse.result).toHaveClarityType(ClarityType.ResponseOk);

  const poxInfo = (
    poxInfoResponse.result as ResponseOkCV<
      TupleCV<{ "reward-cycle-id": UIntCV }>
    >
  ).value.data;
  expect(poxInfo["reward-cycle-id"]).toBeUint(cycle);
}

export function getCycleLength() {
  const poxInfoResponse = getPoxInfo(user.address);
  expect(poxInfoResponse.result).toHaveClarityType(ClarityType.ResponseOk);

  const CYCLE = 1050;
  const PREPARE_CYCLE_LENGTH = 50;

  const poxInfo = (
    poxInfoResponse.result as ResponseOkCV<
      TupleCV<{ "reward-cycle-length": UIntCV; "prepare-cycle-length": UIntCV }>
    >
  ).value.data;
  expect(poxInfo["reward-cycle-length"]).toBeUint(CYCLE);
  expect(poxInfo["prepare-cycle-length"]).toBeUint(PREPARE_CYCLE_LENGTH);
  return {
    CYCLE,
    HALF_CYCLE: CYCLE / 2,
    PREPARE_CYCLE_LENGTH,
  };
}

export const poxAddrCV = (poxAddr: { version: string; hashbytes: string }) => {
  return Cl.tuple({
    hashbytes: Cl.bufferFromHex(
      poxAddr.hashbytes.startsWith("0x")
        ? poxAddr.hashbytes.substring(2)
        : poxAddr.hashbytes
    ),
    version: Cl.bufferFromHex(
      poxAddr.version.startsWith("0x")
        ? poxAddr.version.substring(2)
        : poxAddr.version
    ),
  });
};
