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
  POX_POOLS_1_CYCLE_CONTRACT_NAME,
  delegateStackStx,
  delegateStx,
  poxPools1CycleContract,
} from "./client/pox-pools-1-cycle-client.ts";
import { Errors, PoxErrors, poxAddrPool1 } from "./constants.ts";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet_1 = accounts.get("wallet_1")!;
const wallet_2 = accounts.get("wallet_2")!;

describe(POX_POOLS_1_CYCLE_CONTRACT_NAME, () => {
  it("Ensure that user can't lock stx", () => {
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
    expect(block[1].result).toBeOk(Cl.bool(true));
    // verify delegate-stack-stx by wallet 2
    expect(block[2].result).toBeOk(
      Cl.list([Cl.error(Cl.uint(PoxErrors.StackingPermissionDenied * 1000))])
    );
  });

  it("Ensure that pool operator can't lock for non-member", () => {
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

  it("Ensure that pool operator can't lock for non-member", () => {
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
    expect(block[1].result).toHaveClarityType(ClarityType.ResponseOk);
    let lockingInfoList = (block[1].result as ResponseOkCV<ListCV<ResponseCV>>)
      .value.list;
    expect(lockingInfoList[0]).toBeErr(Cl.uint(Errors.NotFound));
  });
});
