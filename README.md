# FrankenCoin Genesis

It shall support a wide range of collateralized minting methods that are governed by a democratic process.
* Find more details under [website](website/frontpage.md)
* [Frankencoin Research Paper](https://www.snb.ch/n/mmr/reference/sem_2022_06_03_maire/source/sem_2022_06_03_maire.n.pdf)
## Contracts overview

| Contract      | Description |
| ----------- | ----------- |
| Frankencoin.sol       | Contract for the ZCHF IERC20 token |
| Equity.sol            | Contract that holds ZCHF reserve and issues pool shares |
| MintingHub.sol        | Handles auctions and initiates positions (Position.sol) |
| Position.sol          | A collateralized position |
| StablecoinBridge.sol  | Implementation of a 'bridge-plugin' |
| IFrankencoin.sol      | Interface |
| IReservePool.sol      | Interface |
| IERC677Receiver.sol   | Standard |
| Ownable.sol           | Standard |
| IERC20.sol            | Standard |
| ERC20.sol             | Standard |

## Voting

`beforeTokenTransfer` is called with `mint` (from=address(0)) and `burn` (to=address(0)) and regular transfers (both from and to are not 0).

* send from, to: 
    * from votes change
    * to votes (unchanged now but changed anchor)
    * total votes change
 * burn (to=0):
    * from votes change
    * total votes change
 * mint (from=0):
    * to votes unchanged now but changed anchor
    * total votes unchanged now but changed anchor

## Votes
Let  
$b_i$ : balance of owner $i$  
$B$ : total supply (sum of all $b_i$)  
$\beta$ : block number  
$a_i$ : a timestamp we term "anchor", of owner $i$
$v_i$ : voting power of owner $i$  
$V$ : total votes  

We define the voting power of owner $i$ as $v_i := b_i (\beta - a_i)$, from which follows that the total votes are given by

$$
V = \sum_i v_i = \sum_i b_i (\beta - a_i) = (\sum_i b_i) \beta - (\sum_i b_i a_i)
$$

Sending tokens leaves $a_i$ unchanged for owner $i$. When receiving tokens, $a_i$ of receiver $i$ is adjusted so
that their voting power remains unchanged in the same block,

$a_i'= \beta - \frac{b_i (\beta_t - a_i)}{b_i + \delta}$, where $\beta_t$ is the current block at the time
of the adjustment. That is, we adjust $a_i \leftarrow a_i'$. Derivation for $a_i'$ further below.

### Transfer of reserve-tokens
We now express $V$ when tokens $\delta$ are sent from owner $m$ to receiver $k$ with the variables
before adjusting balances $b_m$ and $b_k$ and anchor $a_k$.

The total balance $(\sum_i b_i)$ remains unchanged, since $b_m$ decreases by $\delta$ and $b_k$ increases by $\delta$.
The weighted sum of balances, $(\sum_i b_i a_i)$ changes due to the changes of balances $b_m$ and $b_k$ and
the change of $a_k$ ($a_m$ remains unchanged by definition). The changes are

sender : $-\delta a_m $  
receiver: $ - b_k a_k + (b_k + \delta) a_k' = \delta \beta_t$, where $a_k'$ is the adjusted anchor,
and we index $\beta_t$ by $t$ to emphasize that this is the current block number at the time
when the adjustment of $a_k$ is applied, as opposed to the variable block number $\beta$. The equality
follows by inserting $a_i'$ and simplifying. 

We can now write $V$ after the transfer in terms of the pre-transfer values:

 (1) $V \leftarrow  (\sum_i b_i) \beta - (\sum_i b_i a_i) + \delta a_m - \delta \beta_t$.

We see that the total votes after the transfer differs by $ \delta a_m - \delta \beta_t$ from the total
votes before the transfer. Note that the block $\beta$ is variable, whereas the $\delta$, $\beta_t$, 
and $a_m$ remain.

### Minting of reserve-tokens
The total supply increases by $\delta$, and there is no sender. Hence:  
(2) $V \leftarrow  (\sum_i b_i) \beta + \delta \beta - (\sum_i b_i a_i) - \delta \beta_t$.
We see that $\delta \beta$ cancels at the block of the adjustment when $\beta_t=\beta$.

### Burning of reserve-tokens
The total supply decreases by $\delta$, and there is no receiver. Hence:  
(3) $V \leftarrow  (\sum_i b_i) \beta - \delta \beta - (\sum_i b_i a_i) + \delta a_m$.


### Implementation

(1)  
``lostVotes = from == address(0x0) ? 0 : votes(from) * amount / balanceOf(from)``
``totalVoteAnchor = uint64(block.number - (totalVotes() - lostVotes) / newSupply)``

(2) unless we burn

``voteAnchor[to] = block.number - (votes(to) / (balanceOf(to) + amount))``

We define $A:=$'totalVoteAnchor' and total votes function $V(\beta) = (\sum_i b_i) (\beta - A)$.  

Expression (2) is per definition of how $a_i$ for receiver $i$ is updated: 
$a_i'= \beta - \frac{b_i (\beta_t - a_i)}{b_i + \delta}$.
Expression (1) in mathematical notation is equivalent to

$\ell = b_m (\beta_t - a_m) \delta / b_m=(\beta_t - a_m) \delta$ for sender $m>0$, $0$ if $m=0$ (minted).  
$A \leftarrow \beta_t - \frac{V_t - \ell}{\sum_i b_i + \delta'}$, where $t$ emphasizes that the value is dependent on the current block number.
with $\delta'=0$ for transfers, $\delta'=\delta$ for minting, $\delta'=-\delta$ when burning.  

We now evaluate the votes function $V(\beta)$ defined above with the updated $A$ and
aim to receive equivalent results as in the previous paragraphs.

#### Transfer
For brevity $B' := \sum_i b_i + \delta'$, which for the transfer case equals $B' = \sum_i b_i$, 
and we look at the transfer case in small steps. We have $V_t = B'(\beta_t-A)$, hence

$$
\begin{aligned}
  V(\beta) &= B' (\beta - A) \\
           & = B'\beta - B' \beta_t + B' \frac{V_t - \ell}{B'} \\
           & = B'\beta - B' \beta_t + V_t - (\beta_t - a_m) \delta \\
           & = B'\beta - B' \beta_t + B'(\beta_t-A) -  (\beta_t - a_m) \delta  \\
           & = B'(\beta -A) -\beta_t \delta + a_m\delta, \\
\end{aligned}
$$

where $A$ is prior to its update at time $t$, and $m$ is the index of the owner that sends tokens. 
The first term, $B'(\beta -A)$, is for the transfer case equal to
the previous total votes value (as if no transfer happened), evaluated at the current block, 
and we see that the adjustments $-\beta_t \delta + a_i\delta$
are equivalent to the result in the previous paragraph, Equation (1).
At initialization, $A$ is zero, the formula also coincides with the ones established, which provides the basis for the induction.
Hence we established equality of the implementation and Equation (1) for the transfer case.

#### Mint
For the minting case  $B' = \sum_i b_i + \delta$ and $A \leftarrow \beta_t - V_t/B'$
and $V_t =  \sum_i b_i (\beta_t-A)$ hence

$$
\begin{aligned}
  V(\beta) &= B' (\beta - A) \\
           & = B'\beta - B' \beta_t + V_t \\
           & = B'\beta - B' \beta_t + V_t \\
           & = B'\beta - B' \beta_t + \sum_i b_i (\beta_t-A) \\
           & = \sum_i b_i (\beta - A) + \delta \beta - \delta \beta_t
\end{aligned}
$$

Again, $\sum_i b_i (\beta - A)$ is the previous voting power before minting evaluated at the current block. We
see that the expression we derived is equivalent to Equation (2).

#### Burn
For the burn case  $B' = \sum_i b_i - \delta$ and $A \leftarrow \beta_t - (V_t-\ell)/B'$
and $V_t = \sum_i b_i (\beta_t-A) = B'(\beta_t-A) + \delta (\beta_t-A)$ hence,
assuming $m$ is the index of the owner that burns tokens:

$$
\begin{aligned}
  V(\beta) &= B' (\beta - A) \\
           & = B'\beta - B' \beta_t + B' \frac{V_t - \ell}{B'} \\
           & = B'\beta - B' \beta_t + V_t - (\beta_t - a_m) \delta \\
           & = B'\beta - B' \beta_t + B'(\beta_t-A) + \delta (\beta_t-A) - (\beta_t - a_m) \delta \\
           & = B' (\beta - A)  + \delta (\beta_t-A) - (\beta_t - a_m) \delta \\
           & = \sum_i b_i (\beta - A) - \delta (\beta - A) + \delta (\beta_t-A) - (\beta_t - a_m) \delta \\
           & = \sum_i b_i (\beta - A) - \delta \beta + a_m \delta \\
\end{aligned}
$$

Again, $\sum_i b_i (\beta - A)$ is the previous voting power before burning evaluated at the current block.
We see that the expression we derived is equivalent to Equation (3).


## Fee calibration 
See 
[Frankencoin Research Paper](https://www.snb.ch/n/mmr/reference/sem_2022_06_03_maire/source/sem_2022_06_03_maire.n.pdf)

Calculation examples in [Risk folder](Risk/parameters.py)

# Hardhat
It's best to install node via [nvm](https://heynode.com/tutorial/install-nodejs-locally-nvm/).
Once installed, try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
GAS_REPORT=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

ABIs can be found in `/abi` and are generated upon compilation (setting in hardhat.config.ts).
# Deployment
Define the private key from your deployer address as an environment variable, and then run a script with
a parameter (e.g., `sepolia` that specifies the network:

`$ export PK=322...` 
'$ export APIKEY=A231...`
`$ npx hardhat deploy --network sepolia --tags MockTokens`
or
`$ npx hardhat deploy --network sepolia --tags main` (potentially add  `--reset` undo deletion of MockTokens)

The networks are configured in `package.json`, the command is specified in `hardhat.config.ts`.

`npx hardhat verify "0x..." --network sepolia`
