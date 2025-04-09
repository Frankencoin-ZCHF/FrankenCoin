import { mainnet, polygon, sepolia, polygonAmoy } from "viem/chains";
import { Address, zeroAddress } from "viem";

export interface ChainAddress {
  frankenCoin: Address;
  equity: Address;
  wFPS: Address;
  bridge: Address;
  xchf: Address;
  savings: Address;
  roller: Address;
  mintingHubV1: Address;
  positionFactoryV1: Address;
  mintingHubV2: Address;
  positionFactoryV2: Address;

  bridgePolygonFrankencoin?: Address;
  bridgePolygonWfps?: Address;
  bridgeArbitrumFrankencoin?: Address;
  bridgeArbitrumWfps?: Address;
  bridgeOptimismFrankencoin?: Address;
  bridgeOptimismWfps?: Address;

  // ccip addresses
  router: Address;
  chainSelector: string;
  rmnProxy: Address;
  tokenAdminRegistry: Address;
  registryModuleOwner: Address;
  ccipAdmin: Address;
  tokenPool: Address;
  linkToken: Address;

  // accept any optional key
  // [key: string]: Address | undefined;
}

export const ADDRESS: Record<number, ChainAddress> = {
  [mainnet.id]: {
    // natice contract addresses
    frankenCoin: "0xB58E61C3098d85632Df34EecfB899A1Ed80921cB",
    equity: "0x1bA26788dfDe592fec8bcB0Eaff472a42BE341B2",
    wFPS: "0x5052D3Cc819f53116641e89b96Ff4cD1EE80B182",
    bridge: "0x7bbe8F18040aF0032f4C2435E7a76db6F1E346DF",
    xchf: "0xb4272071ecadd69d933adcd19ca99fe80664fc08",
    savings: "0x3BF301B0e2003E75A3e86AB82bD1EFF6A9dFB2aE",
    roller: "0xAD0107D3Da540Fd54b1931735b65110C909ea6B6",
    mintingHubV1: "0x7546762fdb1a6d9146b33960545C3f6394265219",
    positionFactoryV1: "0x0CDE500e6940931ED190ded77bb48640c9486392",
    mintingHubV2: "0xDe12B620A8a714476A97EfD14E6F7180Ca653557",
    positionFactoryV2: "0x728310FeaCa72dc46cD5BF7d739556D5668472BA",

    // bridge contracts for ZCHF
    bridgePolygonFrankencoin: "0x02567e4b14b25549331fCEe2B56c647A8bAB16FD",
    bridgeArbitrumFrankencoin: "0xB33c4255938de7A6ec1200d397B2b2F329397F9B",
    bridgeOptimismFrankencoin: "0x4F8a84C442F9675610c680990EdDb2CCDDB8aB6f",

    // bridge contracts for WFPS
    bridgePolygonWfps: "0x54Cc50D5CC4914F0c5DA8b0581938dC590d29b3D",
    bridgeArbitrumWfps: zeroAddress,
    bridgeOptimismWfps: zeroAddress,

    // CCIP addresses
    router: "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D",
    chainSelector: "5009297550715157269",
    rmnProxy: "0x411dE17f12D1A34ecC7F45f49844626267c75e81",
    tokenAdminRegistry: "0xb22764f98dD05c789929716D677382Df22C05Cb6",
    registryModuleOwner: "0x4855174E9479E211337832E109E7721d43A4CA64",
    ccipAdmin: zeroAddress,
    tokenPool: zeroAddress,
    linkToken: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  },
  [polygon.id]: {
    // For test deployment only
    frankenCoin: "0x89C31867c878E4268C65de3CDf8Ea201310c5851",
    equity: "0x5e97Bb61440f3BbaB94Bbb61C41159B675175D49",
    wFPS: "0x47Cb2fF74F92d14184ABa028a744371aD07F3036",
    bridge: zeroAddress, // not used
    xchf: zeroAddress, // not used
    savings: "0xc50bF51ee9AaC98E2886ABD8c18876dA11D38709",
    roller: "0xA640dcc5a7050020A7b38D57bEe2C06a4301fb4E",
    mintingHubV1: "0x2357dc93cA35b4d761e6A1bbad070C2493A6ff7C",
    positionFactoryV1: "0x56Fa604fD5F96e456798F2dB50c88528A8a81F57",
    mintingHubV2: "0xf214ea93D12F425F71Fc28b5D15F38E700e2daeC",
    positionFactoryV2: "0x151E58D4dAA67EC33f4809491441791e48d1Fe56",

    // CCIP addresses
    router: "0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe",
    chainSelector: "4051577828743386545",
    rmnProxy: "0xf1ceAa46D8d13Cac9fC38aaEF3d3d14754C5A9c2",
    tokenAdminRegistry: "0x00F027eA6D0fb03256A15E9182B2B9227A4931d8",
    registryModuleOwner: "0xc751E86208F0F8aF2d5CD0e29716cA7AD98B5eF5",
    ccipAdmin: zeroAddress,
    tokenPool: zeroAddress,
    linkToken: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
  },
  [sepolia.id]: {
    // For test deployment only
    frankenCoin: "0x8Ae0F967d59e2aEdF884248aF68bEc1932eb0435",
    equity: "0x266f09eD17B7B7A8D1725Fd61B3935Ab02bA5f2b",
    wFPS: zeroAddress,
    bridge: zeroAddress, // not used
    xchf: zeroAddress, // not used
    savings: "0xc6AEE9905648dB57ed700b1666650C5d8daE0d9F",
    roller: "0x34683eD1E0332d17E11C35f0eA90DC6C91f819AB",
    mintingHubV1: zeroAddress,
    positionFactoryV1: zeroAddress,
    mintingHubV2: "0x4a45B1B5308669ebA4D353f7291ccB2cE6632Eb6",
    positionFactoryV2: "0x8B256a5d65959Df60C72648153842909128f17F3",

    // CCIP addresses
    router: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
    chainSelector: "16015286601757825753",
    rmnProxy: "0xba3f6251de62dED61Ff98590cB2fDf6871FbB991",
    tokenAdminRegistry: "0x95F29FEE11c5C55d26cCcf1DB6772DE953B37B82",
    registryModuleOwner: "0x62e731218d0D47305aba2BE3751E7EE9E5520790",
    ccipAdmin: "0x39f6934D0C15Ef7bff883280aD97749DfBeaE8d5",
    tokenPool: "0xE9BD9035aAc87B84478C665f32FaAFA8858C626a",
    linkToken: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
  },
  [polygonAmoy.id]: {
    // For test deployment only
    frankenCoin: "0x8BBcbe81FFCa30DE315d4CF6fdF839F7A01Aa4E3",
    equity: "0xF4B56a8dD79b37658d36B0313CeA7BC43BA8157C",
    wFPS: zeroAddress,
    bridge: zeroAddress, // not used
    xchf: zeroAddress, // not used
    savings: zeroAddress,
    roller: zeroAddress,
    mintingHubV1: zeroAddress,
    positionFactoryV1: zeroAddress,
    mintingHubV2: zeroAddress,
    positionFactoryV2: zeroAddress,

    // CCIP addresses
    router: zeroAddress,
    chainSelector: "16015286601757825753",
    rmnProxy: zeroAddress,
    tokenAdminRegistry: zeroAddress,
    registryModuleOwner: zeroAddress,
    ccipAdmin: "0x357f74a97019D601D5702665172F6D4B89A4536b",
    tokenPool: "0x763fE4f60528dbc560C206030faFB4Ab883D4d3E",
    linkToken: zeroAddress,
  },
};
