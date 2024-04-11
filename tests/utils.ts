import { Cl } from "@stacks/transactions";
import { expect } from "vitest";
import {
  getPartialStackedByCycle,
  getRewardSetPoxAddress,
} from "./client/pox-4-client.js";
import { poxPoolsSelfServiceContract } from "./client/pox-pool-self-service-client.js";

export function expectPartialStackedByCycle(
  poxAddr: { version: string; hashbytes: string },
  cycle: number,
  amountUstx: number | undefined,
  deployer: string
) {
  const result = getPartialStackedByCycle(
    poxAddr,
    cycle,
    poxPoolsSelfServiceContract,
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
