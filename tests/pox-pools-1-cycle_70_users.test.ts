import {
  Cl,
  ClarityType,
  StacksPrivateKey,
  getAddressFromPrivateKey,
  makeRandomPrivKey,
} from "@stacks/transactions";
import { allowContractCaller } from "./client/pox-4-client.js";
import {
  POX_POOLS_1_CYCLE_CONTRACT_NAME,
  delegateStackStx,
  delegateStx,
  getTotal,
  poxPools1CycleContract,
} from "./client/pox-pools-1-cycle-client.ts";
import { btcAddrWallet1 } from "./constants.ts";
import { TransactionVersion } from "@stacks/common";
import { describe, expect, it } from "vitest";
import { tx } from "@hirosystems/clarinet-sdk";
import { expectOkTrue } from "@stacks/clarunit/src/parser/test-helpers.ts";

function generateWallets(count: number) {
  const users: {
    address: string;
    name: string;
    balanace: 0;
  }[] = [];

  let privateKey: StacksPrivateKey;
  let address: string;
  for (let index = 0; index < count; index++) {
    privateKey = makeRandomPrivKey();
    address = getAddressFromPrivateKey(
      privateKey.data,
      TransactionVersion.Mainnet
    );
    users.push({
      address: address,
      name: `w${index}`,
      balanace: 0,
    });
  }
  return users;
}

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const faucet = accounts.get("faucet")!;
const wallet_1 = accounts.get("wallet_1")!;

describe("70 users", () => {
  it("pool operator can lock 30 users in batches", () => {
    const amountUstx = 1_000_000;

    const users = generateWallets(70);
    // fill from faucet
    let block = simnet.mineBlock(
      users.map((user) => tx.transferSTX(amountUstx, user.address, faucet))
    );
    block.map((r: any) => expect(r.result).toBeOk(Cl.bool(true)));

    // allow contract caller
    block = simnet.mineBlock(
      users.map((user) =>
        allowContractCaller(poxPools1CycleContract, undefined, user.address)
      )
    );
    block.map((r: any) => expect(r.result).toBeOk(Cl.bool(true)));

    // allow contract caller pool operator and whale
    simnet.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, deployer),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
    ]);

    // delegate all users
    block = simnet.mineBlock(
      users.map((user) =>
        delegateStx(
          amountUstx,
          deployer,
          undefined,
          undefined,
          btcAddrWallet1,
          user.address
        )
      )
    );
    block.map((r: any) => expect(r.result).toBeOk(Cl.bool(true)));

    // delegate whale
    block = simnet.mineBlock([
      delegateStx(
        10_000_000_000_000,
        deployer,
        undefined,
        undefined,
        btcAddrWallet1,
        wallet_1
      ),
    ]);

    // delegate stack stx
    block = simnet.mineBlock([
      delegateStackStx(
        users.slice(0, 30).map((user) => {
          return {
            user: user.address,
            amountUstx,
          };
        }),
        {
          version: "0x01",
          hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
        },
        40,
        deployer
      ),
      delegateStackStx(
        users.slice(30, 60).map((user) => {
          return {
            user: user.address,
            amountUstx,
          };
        }),
        {
          version: "0x01",
          hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
        },
        40,
        deployer
      ),
      delegateStackStx(
        users.slice(60).map((user) => {
          return {
            user: user.address,
            amountUstx,
          };
        }),
        {
          version: "0x01",
          hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
        },
        40,
        deployer
      ),
      delegateStackStx(
        [
          {
            user: wallet_1,
            amountUstx: 10_000_000_000_000,
          },
        ],
        {
          version: "0x01",
          hashbytes: "0xb0b75f408a29c271d107e05d614d0ff439813d02",
        },
        40,
        deployer
      ),
    ]);
    block.map((r: any) =>
      expect(r.result).toHaveClarityType(ClarityType.ResponseOk)
    );

    // verify total
    const total = getTotal(deployer, 1, deployer);
    expect(total.result).toBeUint(10_000_070_000_000);
  });
});
