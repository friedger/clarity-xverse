import { tx } from "@hirosystems/clarinet-sdk";
import { Cl } from "@stacks/transactions";
import { poxAddrCV } from "./pox-4-client";

export const POX_POOL_SELF_SERVICE_CONTRACT_NAME = "pox-pool-self-service-v2";
export const poxPoolSelfServiceContract =
  simnet.getAccounts().get("deployer")!! +
  "." +
  POX_POOL_SELF_SERVICE_CONTRACT_NAME;

export function fpDelegationAllowContractCaller(
  contractCaller: string,
  untilBurnHt: number | undefined,
  user: string
) {
  return tx.callPublicFn(
    POX_POOL_SELF_SERVICE_CONTRACT_NAME,
    "allow-contract-caller",
    [
      Cl.principal(contractCaller),
      untilBurnHt ? Cl.some(Cl.uint(untilBurnHt)) : Cl.none(),
    ],
    user
  );
}

export function delegateStx(amount: number, user: string) {
  return tx.callPublicFn(
    POX_POOL_SELF_SERVICE_CONTRACT_NAME,
    "delegate-stx",
    [Cl.uint(amount)],
    user
  );
}

export function delegateStackStx(stacker: string, user: string) {
  return tx.callPublicFn(
    POX_POOL_SELF_SERVICE_CONTRACT_NAME,
    "delegate-stack-stx",
    [Cl.principal(stacker)],
    user
  );
}

export function delegateStackStxMany(stackers: string[], user: string) {
  return tx.callPublicFn(
    POX_POOL_SELF_SERVICE_CONTRACT_NAME,
    "delegate-stack-stx-many",
    [Cl.list(stackers.map((s) => Cl.principal(s)))],
    user
  );
}

// admin functions

export function setActive(active: boolean, user: string) {
  return tx.callPublicFn(
    POX_POOL_SELF_SERVICE_CONTRACT_NAME,
    "set-active",
    [Cl.bool(active)],
    user
  );
}

export function setStxBuffer(amount: number, user: string) {
  return tx.callPublicFn(
    POX_POOL_SELF_SERVICE_CONTRACT_NAME,
    "set-stx-buffer",
    [Cl.uint(amount)],
    user
  );
}

export function setPoolPoxAddress(
  poxAddress: { hashbytes: string; version: string },
  user: string
) {
  return tx.callPublicFn(
    POX_POOL_SELF_SERVICE_CONTRACT_NAME,
    "set-pool-pox-address",
    [poxAddrCV(poxAddress)],
    user
  );
}

export function setRewardAdmin(
  newAdmin: string,
  enable: boolean,
  user: string
) {
  return tx.callPublicFn(
    POX_POOL_SELF_SERVICE_CONTRACT_NAME,
    "set-reward-admin",
    [Cl.principal(newAdmin), Cl.bool(enable)],
    user
  );
}
