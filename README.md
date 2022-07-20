# FrankenCoin Genesis

It shall support a wide range of collateralized minting methods that are governed by a democratic process.

## Fee calibration 
For liquid collateral contracts, see [PDF](docs/ZCHF_RiskMgmt.pdf)

Calculations in [Risk folder](Risk/parameters.py)
## Testing with hardhat 
* clone repo
* install npm
* cd to FrankenCoin directory
* npm install
* npm install --save-dev hardhat
* npx hardhat compile
* Run tests
    * npx hardhat test tests/yourtest.ts *or run all tests with*
    * npx hardhat test
