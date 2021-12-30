# FrankenCoin Genesis

It shall support a wide range of collateralized minting methods that are governed by a democratic process.

## Governance Contract
tbd
## Minting Contract
The base contract is open to accept any type of minting contracts that adhere to the minting interface.
Each minting contract inherits from Minting.sol, the base contract, and implements its virtual functions.

ZCHF minting contracts have the following properties
* The minter deposits collateral in the form of an ERC-20 token into the minting contract
* The required amount of initial collateral, respectively the amount of ZCHF minted per amount of collateral, is determined by the concrete minting contract
* A *position* is defined by an ID which is unique across the tuple `(minting contract, collateral token address, sender of the collateral)`
* A position can be liquidated if the collateral falls below a certain threshold. The threshold is defined by the concrete minting contract. Anyone can liquidate a position, if `meetsCollateralRequirement(positionID)` returns `true`.
* The concrete minting contract also defines how much ZCHF have to be held in the *Governance* contract as a reserve. The definition is communicated via `getReserveRequirement`. 
E.g., if this function returns 0.10, then the governance
contract must hold at least 10\% of the total tokens
minted by this contract (accordingly in the precense of
multiple minters). The reserve requirement taps into
a shared pool of ZCHF and has to be met for tokens
to be minted. A relevant function for this
requirement is `getCirculatingAmount`, which returns the
amount of tokens minted by this contract (and not burned).

## Testing with hardhat 
* clone repo
* install npm
* cd to FrankenCoin directory
* npm -i
* npx hardhat compile
* Run tests
    * npx hardhat test tests/yourtest.ts *or run all tests with*
    * npx hardhat test
