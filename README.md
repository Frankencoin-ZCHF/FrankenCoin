# FrankenCoin Genesis

It shall support a wide range of collateralized minting methods that are governed by a democratic process.
* Find more details under [website](website/frontpage.md)
* [Frankencoin Research Paper](https://www.snb.ch/n/mmr/reference/sem_2022_06_03_maire/source/sem_2022_06_03_maire.n.pdf)
## Contracts overview

| Contract      | Description |
| ----------- | ----------- |
| Frankencoin.sol       | Contract for the ZCHF IERC20 token |
| ReservePool.sol       | Contract that holds ZCHF reserve and issues pool tokens |
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

### How to keep track of total votes
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

The total supply $B$ is given by $B = (\sum_i b_i) $, and by defining $A:=(\sum_i b_i a_i)/B$ as the total
votes anchor, such that the total voting power can be expressed with a similar formula than the individual voting power:

$$
V = B (\beta - A).
$$

We see that $A$ only changes when the voting power of an individual changes, and hence we can keep track of the
total voting power by updating $A$ with every transfer/mint/burn of tokens. To simplify the calculations,
we abandon the similarity of the formulas for $v_i$ and $V$ and work with $\bar{A} := \sum_i b_i a_i$. It follows  

$$
V = B \beta - \bar{A}.
$$

#### Voting power change when tokens are sent/burnt
We want the voting power to decrease in line with the change in balance, therefore
we postulate that the anchor $a_i$ remains unchanged. The change in voting power therefore
is a sole consequence of the owner's token balance $b_i$ shrinking by $\delta$.

Hence by definition, $v_i := b_i (\beta - a_i)$,
changes due to a changed balance $b_i \leftarrow b_i - \delta$.  
To have a correct total balance $V$, we adjust $\bar{A}$. From the definition of $\bar{A}$, we can see that the following
adjustment needs to be made for $\bar{A}$ to be correct if the token is transferred:  
$A \leftarrow A - \delta a_i$, so that after adjusting $b_j$ for owner $j$, $\bar{A}=(\sum_i b_i a_i)$.

To summarize:
* $A \leftarrow A - \delta a_i$  
* $a_i$ : no change
* $b_i \leftarrow b_i - \delta$

#### Voting power change when tokens are received/minted
When an owner receives $\delta$ more share-tokens, we adjust the anchor so that their voting power remains the same at the
current block and only increases later on. 

To do so, we take the definition of $v_i$ and look for the new anchor
$a_i'$ for which the voting power after depositing $\delta$ is the same as before:  

$$
b_i (\beta - a_i) \overset{!}{=} (b_i+\delta) (\beta - a_i')
$$

where the left hand side is the definition of $v_i$ and the right hand side is $v_i$ after receiving $\delta$ share-tokens. We get 

$$
a_i' = \beta - \frac{b_i (\beta - a_i)}{b_i + \delta}
$$

To have a correct total balance $V=B \beta - \bar{A}$, we adjust $\bar{A}$. 
By the definition of $\bar{A}$, we have adjust $\bar{A}$ as $\bar{A} \leftarrow \bar{A} - b_i a_i + (b_i+\delta) a_i'$.
When inserting $a_i'$ this formula simplifies to what we show in the summary.

To summarize:
* $A \leftarrow A +\delta \beta$
* $a_i \leftarrow \beta - \frac{b_i (\beta - a_i)}{b_i + \delta}$
* $b_i \leftarrow b_i + \delta$



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
