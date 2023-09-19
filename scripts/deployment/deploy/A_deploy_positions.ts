import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BigNumber } from "ethers";
import { floatToDec18 } from "../../math";

/*
    HOWTO
    - inspect config file parameters/paramsPositions
    - ensure minter has enough collateral and ZCHF to ask for position
    - run via: npm run-script deployPositions:network sepolia
*/

async function deployPos(params: any, hre: HardhatRuntimeEnvironment) {
  /*
    let tx = await mintingHubContract.openPosition(collateral, minCollateral, 
        fInitialCollateral, initialLimit, duration, challengePeriod, fFees, 
        fliqPrice, fReserve);
    */
  //------
  const {
    deployments: { get },
    ethers,
  } = hre;
  const mintingHubDeployment = await get("MintingHub");
  const fcDeployment = await get("Frankencoin");

  let mintingHubContract = await ethers.getContractAt(
    "MintingHub",
    mintingHubDeployment.address
  );
  let collateralAddr = params.collateralTknAddr;
  let fMinCollateral = floatToDec18(params.minCollateral);
  let fInitialCollateral = floatToDec18(params.initialCollateral);
  let initialLimitZCHF = floatToDec18(params.initialLimitZCHF);
  let duration = BigNumber.from(params.durationDays).mul(86_400);
  let challengePeriod = BigNumber.from(params.challengePeriodSeconds);
  let feesPPM = BigNumber.from(params.feesPercent * 1e4);
  let fliqPrice = floatToDec18(params.liqPriceCHF);
  let fReservePPM = BigNumber.from(params.reservePercent * 1e4);
  let fOpeningFeeZCHF = BigNumber.from(1000).mul(BigNumber.from(10).pow(18));

  let CollateralContract = await ethers.getContractAt(
    params.name,
    params.collateralTknAddr
  );

  //console.log("Collateral balance of owner = ", dec18ToFloat(balColl));
  //console.log("ZCHF balance of owner = ", dec18ToFloat(balZCHF));
  console.log("ZCHF address ", fcDeployment.address);
  console.log("coll address ", CollateralContract.address);

  let tx1 = await CollateralContract.approve(
    mintingHubContract.address,
    fInitialCollateral,
    { gasLimit: 1_000_000 }
  );
  console.log("tx:", tx1.hash);
  await tx1.wait();
  /*
    openPosition(
    address _collateral,
    uint256 _minCollateral,
    uint256 _initialCollateral,
    uint256 _initialLimit,
    uint256 _duration,
    uint256 _challengePeriod,
    uint32 _fees,
    uint256 _liqPrice,
    uint32 _reserve
  */
  // console.log(
  //   collateralAddr.toString(),
  //   fMinCollateral.toString(),
  //   fInitialCollateral.toString(),
  //   initialLimitZCHF.toString(),
  //   duration.toString(),
  //   challengePeriod.toString(),
  //   feesPPM.toString(),
  //   fliqPrice.toString(),
  //   fReservePPM.toString()
  // );
  let tx = await mintingHubContract.openPositionOneWeek(
    collateralAddr,
    fMinCollateral,
    fInitialCollateral,
    initialLimitZCHF,
    duration,
    challengePeriod,
    feesPPM,
    fliqPrice,
    fReservePPM
  );

  await tx.wait();

  // console.log("Arguments for verification of position:");
  // console.log(
  //   `npx hardhat verify --network sepolia <POSITIONADDRESS> ${accounts[0]} ${mintingHubDeployment.address} ${fcDeployment.address} ${collateralAddr} ${fMinCollateral} ${fInitialCollateral} ${initialLimitZCHF} ${duration} ${challengePeriod} ${feesPPM} ${fliqPrice} ${fReservePPM}`
  // );
  return tx.hash;
}

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const paramFile = "paramsPositions.json";

  let chainId = hre.network.config["chainId"];
  let paramsArr = require(__dirname + `/../parameters/${paramFile}`);

  // find config for current chain
  for (var k = 0; k < paramsArr.length; k++) {
    let params = paramsArr[k];
    if (chainId == params.chainId) {
      // deploy position according to parameters
      let txh = await deployPos(params, hre);
      console.log("Deployed position, tx hash =", txh);
    }
  }
};
export default deploy;
deploy.tags = ["positions"];
