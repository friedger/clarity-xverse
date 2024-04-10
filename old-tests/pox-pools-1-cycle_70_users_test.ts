import { allowContractCaller } from "./client/pox-4-client.js";
import {
  delegateStackStx,
  delegateStx,
  getTotal,
} from "./client/pox-pools-1-cycle-client.ts";
import { Clarinet, Tx, Chain, Account, types } from "./deps.ts";
import { btcAddrWallet1 } from "./constants.ts";
import {
  StacksPrivateKey,
  makeRandomPrivKey,
  getAddressFromPrivateKey,
  TransactionVersion,
} from "https://esm.sh/@stacks/transactions";

function generateWallets(count: number) {
  const users: Account[] = [];
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

Clarinet.test({
  name: "Ensure that pool operator can lock 30 users",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const faucet = accounts.get("faucet")!;
    const wallet_1 = accounts.get("wallet_1")!;
    const poxPools1CycleContract = deployer.address + ".pox-pools-1-cycle";
    const amountUstx = 1_000_000;

    const users = generateWallets(70);
    // fill from faucet
    let block = chain.mineBlock(
      users.map((user) =>
        Tx.transferSTX(amountUstx, user.address, faucet.address)
      )
    );
    block.receipts.map((r: any) => r.result.expectOk().expectBool(true));

    // allow contract caller
    block = chain.mineBlock(
      users.map((user) =>
        allowContractCaller(poxPools1CycleContract, undefined, user)
      )
    );
    block.receipts.map((r: any) => r.result.expectOk().expectBool(true));

    // allow contract caller pool operator and whale
    chain.mineBlock([
      allowContractCaller(poxPools1CycleContract, undefined, deployer),
      allowContractCaller(poxPools1CycleContract, undefined, wallet_1),
    ]);

    // delegate all users
    block = chain.mineBlock(
      users.map((user) =>
        delegateStx(
          amountUstx,
          deployer.address,
          undefined,
          undefined,
          btcAddrWallet1,
          user
        )
      )
    );
    block.receipts.map((r: any) => r.result.expectOk().expectBool(true));

    // delegate whale
    block = chain.mineBlock([
      delegateStx(
        10_000_000_000_000,
        deployer.address,
        undefined,
        undefined,
        btcAddrWallet1,
        wallet_1
      ),
    ]);

    // delegate stack stx
    block = chain.mineBlock([
      delegateStackStx(
        users.slice(0, 30).map((user) => {
          return {
            user,
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
            user,
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
            user,
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
    block.receipts.map((r: any) => r.result.expectOk());

    // verify total
    const total = getTotal(deployer.address, 1, chain, deployer);
    total.result.expectUint(10_000_070_000_000);
  },
});
