import { Account, Chain, Tx, types } from "../deps.ts";

const user = {
  address: "ST000000000000000000002AMW42H",
};

export function allowContractCaller(
  contractCaller: string,
  untilBurnHt: number | undefined,
  user: Account
) {
  return Tx.contractCall(
    "ST000000000000000000002AMW42H.pox-4",
    "allow-contract-caller",
    [
      types.principal(contractCaller),
      untilBurnHt ? types.some(types.uint(untilBurnHt)) : types.none(),
    ],
    user.address
  );
}

export function delegateStx(amount: number, delegateTo: string, user: Account) {
  return Tx.contractCall(
    "ST000000000000000000002AMW42H.pox-4",
    "delegate-stx",
    [
      types.uint(amount),
      types.principal(delegateTo),
      types.none(),
      types.none(),
    ],
    user.address
  );
}

export function delegateStackExtend(
  stacker: Account,
  poxAddr: { version: string; hashbytes: string },
  extendedCount: number,
  user: Account
) {
  return Tx.contractCall(
    "ST000000000000000000002AMW42H.pox-4",
    "delegate-stack-extend",
    [
      types.principal(stacker.address),
      types.tuple(poxAddr),
      types.uint(extendedCount),
    ],
    user.address
  );
}

export function stackAggregationCommitIndexed(
  poxAddr: { version: string; hashbytes: string },
  cycle: number,
  poolOperator: Account
) {
  return Tx.contractCall(
    "ST000000000000000000002AMW42H.pox-4",
    "stack-aggregation-commit-indexed",
    [types.tuple(poxAddr), types.uint(cycle)],
    poolOperator.address
  );
}

export function stackAggregationIncrease(
  poxAddr: { version: string; hashbytes: string },
  cycle: number,
  poxAddrIndex: number,
  poolOperator: Account
) {
  return Tx.contractCall(
    "ST000000000000000000002AMW42H.pox-4",
    "stack-aggregation-increase",
    [types.tuple(poxAddr), types.uint(cycle), types.uint(poxAddrIndex)],
    poolOperator.address
  );
}

export function revokeDelegateStx(user: Account) {
  return Tx.contractCall(
    "ST000000000000000000002AMW42H.pox-4",
    "revoke-delegate-stx",
    [],
    user.address
  );
}

export function getPartialStackedByCycle(
  poolPoxAddr: { version: string; hashbytes: string },
  cycle: number,
  poolAddress: string,
  chain: Chain,
  user: Account
) {
  return chain.callReadOnlyFn(
    "ST000000000000000000002AMW42H.pox-4",
    "get-partial-stacked-by-cycle",
    [types.tuple(poolPoxAddr), types.uint(cycle), types.principal(poolAddress)],
    user.address
  );
}

export function getRewardSetPoxAddress(
  cycle: number,
  index: number,
  chain: Chain,
  user: Account
) {
  return chain.callReadOnlyFn(
    "ST000000000000000000002AMW42H.pox-4",
    "get-reward-set-pox-address",
    [types.uint(cycle), types.uint(index)],
    user.address
  );
}

export function getPoxInfo(chain: Chain, user: Account) {
  return chain.callReadOnlyFn(
    "ST000000000000000000002AMW42H.pox-4",
    "get-pox-info",
    [],
    user.address
  );
}

export async function asyncExpectCurrentCycle(chain: Chain, cycle: number) {
  const poxInfoResponse = await getPoxInfo(chain, user);
  const poxInfo = poxInfoResponse.result.expectOk().expectTuple();
  poxInfo["reward-cycle-id"].expectUint(cycle);
}

export async function getCycleLength(chain: Chain) {
  const poxInfoResponse = await getPoxInfo(chain, user);
  const poxInfo = poxInfoResponse.result.expectOk().expectTuple();

  const CYCLE = 1050;
  const PREPARE_CYCLE_LENGTH = 50;
  poxInfo["reward-cycle-length"].expectUint(CYCLE);
  poxInfo["prepare-cycle-length"].expectUint(PREPARE_CYCLE_LENGTH);
  return {
    CYCLE,
    HALF_CYCLE: CYCLE / 2,
    PREPARE_CYCLE_LENGTH,
  };
}
