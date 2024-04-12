import { Cl, ClarityValue } from "@stacks/transactions";
import { expect } from "vitest";
import {
  getPartialStackedByCycle,
  getRewardSetPoxAddress,
} from "./client/pox-4-client.js";
import { poxPoolSelfServiceContract } from "./client/pox-pool-self-service-client.js";
import { ParsedTransactionResult } from "@hirosystems/clarinet-sdk";

export function expectPartialStackedByCycle(
  poxAddr: { version: string; hashbytes: string },
  cycle: number,
  amountUstx: number | undefined,
  deployer: string
) {
  const result = getPartialStackedByCycle(
    poxAddr,
    cycle,
    poxPoolSelfServiceContract,
    deployer
  ).result;
  if (amountUstx) {
    expect(result).toBeSome(
      Cl.tuple({ "stacked-amount": Cl.uint(amountUstx) })
    );
  } else {
    expect(result).toBeNone();
  }
}

export function expectTotalStackedByCycle(
  cycle: number,
  index: number,
  amountUstx: number | undefined,
  user: string
) {
  const result = getRewardSetPoxAddress(cycle, index, user).result;
  if (amountUstx) {
    expect(result).toBeSome(Cl.tuple({ "total-ustx": Cl.uint(amountUstx) }));
  } else {
    expect(result).toBeNone();
  }
}

export const expectOkLockingResult = (
  result: ClarityValue | ParsedTransactionResult,
  expectedResult: {
    lockAmount: number;
    stacker: string;
    unlockBurnHeight: number;
  }
) => {
  expect(
    (result as ParsedTransactionResult).result
      ? (result as ParsedTransactionResult).result
      : (result as ClarityValue)
  ).toBeOk(
    Cl.tuple({
      "lock-amount": Cl.uint(expectedResult.lockAmount),
      stacker: Cl.principal(expectedResult.stacker),
      "unlock-burn-height": Cl.uint(expectedResult.unlockBurnHeight),
    })
  );
};
