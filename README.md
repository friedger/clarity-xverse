# Wrapper Contracts for pox-4 contract

This repo contains smart contracts that are wrapping contract calls to the pox-4 contract of the Stacks blockchain. The pox-4 contract is the heart of [Proof of Transfer (PoX)](https://www.stacks.co/learn/stacking).

There are two different wrapper contracts:

- `pox4-pools`: A generic contract for stacking pools that enables custom payout addresses for pool members. Deployed on mainnet at `SP001SFSMC2ZY76PD4M68P3WGX154XCH7NE3TYMX.pox4-pools`.
- `pox4-self-service`: A self-service contract where the smart contract is the pool operator. Deployed on mainnet at `SP21YTSM60CAY6D011EZVEVNKXVW8FVZE198XEFFP.pox4-fast-pool-v3` and

Both contracts require one transaction to allow the contract to handle the user's stacking rights (call to `pox-4.allow-contract-caller`). Furthermore, both contracts implement the same stacking rights protection with `allow-contract-caller` and `disallow-contract-caller` functions.

A web UI for these contracts exists on [lockstack.com](https://github.com/hirosystems/btcweb3).

Users trust the pool admin that they will receive their share of rewards.

## pox4-pools (rewards in BTC)

A wrapper contract that allows users to provide a btc address during delegation to a stacking pool.
The btc address should be used by the pool operator to distribute the stacking rewards.

This contract is a generic protocol and can be used by many pools.

This contract will lock STX for 1 cycle only. Users can revoke pool membership at any time and their STX will unlock automatically 1 day after the end of the current cycle.

Users can increase the delegated amount of STX for the next cycle at any time before the pool closes.

### Function `delegate-stx`

Users call this function to delegate the stacking rights to a pool. Users can revoke delegation and stx tokens will unlock at the end of the next cycle. Locking period is fixed to one cycle.

This function revokes previous delegations to a pool (calls `pox-4.revoke-delegate-stx`) so that only one transaction is required to update stacking delegation.

In addition, the user has to provide a reward address that pool operators should use for reward distribution. All other arguments are passed to directly to the `pox-4.delegate-stx` function.

### Pool operator functions `delegate-stack-stx` and `delegate-stack-stx-simple`

Can be called by pool operator only.

These functions lock pool members' STX tokens in batches of 30.

The `-simple` version locks the maximum amount of STX minus 1 STX buffer. The normal function requires the pool operator to provide the locking amount for each user.

## pox4-self-service

A wrapper contract that allows user to delegate and stack their STX at the same time.

This contract can be used by one pool only because the smart contract address is the pool address.

This contract is not meant for smaller pools where the minimum requirement for 1 stacking slot might not be met because STX are locked immediately. If the pool does not hit the minimum, STX are locked without earning stacking rewards.

The pool operator is the contract itself; only reward distributions happens through the pool operator (=reward admin).

This contract will lock STX for 1 cycle only. Users can revoke pool membership at any time and their STX will unlock automatically 1 day after the end of the current cycle.

This contract can be adapted for users to provide a btc address similar to pox4-pools.

User calls delegate-stx once. For next cycles, users can call delegate-stx or ask automation, friends or family to extend stacking using delegate-stack-stx.
Users can increase the delegated amount of STX for the next cycle at any time before the start of the next cycle.

### Function `delegate-stx`

The self-service function "delegate-stx" does the following:

1. Revoke delegation if necessary.
2. Delegates STX.
3. For first time user, stacks the caller's stx tokens for 1 cycle.
   For stackerd user, extends locking and if needed increases amount.
   The amount is the minimum of the balance and the delegate amount
   minus some STX as buffer.
   The STX buffer is left unlocked for users to call revoke-delegate-stx.

Returns the stacker details when the transaction was successful.

### Function `delegate-stack-stx`

Pool operator function "delegate-stack-stx" does step 3. (for stacked users) as described for function "delegate-stx" for the following cycles.

This function can be called by anyone when less than 1050 blocks are left until the cycle start. This gives the stacker 1 week to unlock the STX - if wanted - before it can be locked again for friends and family (or enemies).

### Reward admin functions

The reward admin is a contract or user that controls the PoX BTC reward address. The admin can

- activate and deactivate the contract (`set-active`),
- change the PoX BTC reward address (`set-pool-pox-address`),
- change the stx buffer for the locked amount (usually 1 STX) (`set-stx-buffer`),
- add and remove more reward admins (`set-reward-admin`).
- aggregate commit the partially stacked STX and increase the committed amount (`maybe-stack-aggregation-commit`)

## Security auditing

### Unit tests

The repo contains a suite of unit tests. The coverage is limited to the functionality that does not require extensive use of pox locking and release handling. This pox feature is not supported by simnet.

Coverage data for unit tests is available in the `coverage-web` folder.

### Integration tests with vitest and stacks-devnet-js

The folder `integration` contains a setup of integration test with devnet that can be launched with `yarn test:dev`. This is work in progress.

### Integration tests with clarinet integrate

Using `clarinet integrate` allows to work through all stages of the pool on devnet. The web UI supports these contracts. You can use the secret phrases in `settings/Devnet.toml`.

There is one set of deployment plans for each contract.

Deployment plans starting with `0-`, `1-` etc are for `pox-pools-1-cycle`. Deployment plans starting with `fp-0-`, `fp-1-` etc is for `pox-pool-self-service`.

There is also a `helper.clar` contract that wraps read-only functions into public functions so that they can be called via deployment plans (`helper.yaml`).

The allow contract calls must be called once at the beginning. Then the delegate and delegate-stack plans can be used for each cycle.

Example to use deployment plan:

```
clarinet deployment apply -p deployments/0-allow-contract-caller.devnet-plan.yaml
```
