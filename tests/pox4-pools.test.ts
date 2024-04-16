import {
  Cl,
  ClarityType,
  ListCV,
  ResponseCV,
  ResponseOkCV,
  cvToString,
} from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { allowContractCaller } from "./client/pox-4-client.js";
import {
  POX4_POOLS,
  delegateStackStx,
  delegateStx,
  pox4PoolsContract,
} from "./client/pox4-pools-client.ts";
import { Errors, PoxErrors, poxAddrPool1 } from "./constants.ts";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const wallet_2 = accounts.get("wallet_2")!;

describe(POX4_POOLS, () => {
  it("Ensure that user can't lock stx", () => {
    let block = simnet.mineBlock([
      allowContractCaller(pox4PoolsContract, undefined, wallet_1),

      delegateStx(
        1_000_000_000,
        deployer,
        4000,
        undefined,
        {
          version: "0x01",
          hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
        },
        wallet_1
      ),

      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1000000,
          },
        ],
        {
          version: "0x01",
          hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
        },
        2,
        wallet_2
      ),
    ]);

    expect(block[0].result).toBeOk(Cl.bool(true));
    expect(block[1].result).toBeOk(Cl.bool(true));
    // verify delegate-stack-stx by wallet 2
    expect(block[2].result).toBeOk(
      Cl.list([Cl.error(Cl.uint(PoxErrors.StackingPermissionDenied * 1000))])
    );
  });

  it("Ensure that pool operator can't lock for non-member", () => {
    let block = simnet.mineBlock([
      allowContractCaller(pox4PoolsContract, undefined, deployer),

      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 1000000,
          },
        ],
        poxAddrPool1,
        40,
        deployer
      ),
    ]);

    expect(block[0].result).toBeOk(Cl.bool(true));
    // verify delegate-stack-stx by wallet 2
    expect(block[1].result).toBeOk(
      Cl.list([Cl.error(Cl.uint(Errors.NotFound))])
    );
  });
});
