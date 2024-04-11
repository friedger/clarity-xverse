import { Cl, cvToString } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { allowContractCaller } from "./client/pox-4-client.js";
import {
  delegateStackStx,
  delegateStx,
} from "./client/pox-pools-1-cycle-client.ts";
import { Errors, PoxErrors, poxAddrPool1 } from "./constants.ts";

const accounts = simnet.getAccounts();

describe("pox-pools-1-cycle-v2", () => {
  it("Ensure that user can't lock stx", () => {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    let wallet_2 = accounts.get("wallet_2")!;
    const poxPools1CycleContract = deployer + ".pox-pools-1-cycle-v2";

    let block = simnet.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),

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
    console.log(cvToString(block[1].result));
    expect(block[1].result).toBeOk(Cl.bool(true));
    // verify delegate-stack-stx by wallet 2
    expect(block[2].result).toBeOk(
      Cl.list([Cl.error(Cl.uint(PoxErrors.StackingPermissionDenied * 1000))])
    );
  });

  it("Ensure that pool operator can't lock for non-member", () => {
    let deployer = accounts.get("deployer")!;
    let wallet_1 = accounts.get("wallet_1")!;
    const poxPools1CycleContract = deployer + ".pox-pools-1-cycle";

    let block = simnet.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, deployer),

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
