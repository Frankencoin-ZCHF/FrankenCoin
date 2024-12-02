import { Signer, TypedDataDomain } from "ethers";
import { ethers } from "ethers";
import type { BigNumberish } from "ethers/src.ts/utils";
import { EIP3009 } from "../../typechain";

export async function getCancelAuthorizationSignature(token: EIP3009, signer: Signer, authorizer: string, nonce: Uint8Array) {
  const domain = await _getDomain(token, signer);

  return ethers.Signature.from(await signer.signTypedData(domain, {
    CancelAuthorization: [{name: "authorizer", type: "address"}, {name: "nonce", type: "bytes32"}]
  }, {
    authorizer, nonce
  }))
}

export async function getTransferAuthorizationSignature(token: EIP3009, signer: Signer, from: string, to: string, value: bigint, validAfter: number, validBefore: number, nonce: Uint8Array) {
  const domain = await _getDomain(token, signer);

  return ethers.Signature.from(await signer.signTypedData(domain, {
    TransferWithAuthorization: [
      {name: "from", type: "address"},
      {name: "to", type: "address"},
      {name: "value", type: "uint256"},
      {name: "validAfter", type: "uint256"},
      {name: "validBefore", type: "uint256"},
      {name: "nonce", type: "bytes32"}
    ]
  }, {
    from, to, value, validAfter, validBefore, nonce
  }))
}

async function _getDomain(token: EIP3009, signer: Signer) {
  const [name, version, network, address] = await Promise.all([token.name(), "1", signer.provider?.getNetwork(), token.getAddress()]);

  return new EPI721Domain(name, version, network!.chainId, address);
}

// The class implementing the TypedDataDomain interface
class EPI721Domain implements TypedDataDomain {
  // Define the necessary properties of TypedDataDomain
  name: string;
  version: string;
  chainId: BigNumberish;
  verifyingContract: string;

  constructor(
    name: string,
    version: string,
    chainId: BigNumberish,
    verifyingContract: string
  ) {
    this.name = name;
    this.version = version;
    this.chainId = chainId;
    this.verifyingContract = verifyingContract;
  }
}
