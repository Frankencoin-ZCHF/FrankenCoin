import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TestToken } from "../typechain";
import {
  getCancelAuthorizationSignature,
  getTransferAuthorizationSignature
} from "./helper/signer";
import {
  getFutureTimeStamp
} from "./helper";


const oneETH = ethers.parseEther("1");

describe("ERC3009 Tests", () => {
  let testToken: TestToken;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let ts: number;

  before(async () => {
    [owner, alice] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("TestToken");
    testToken = await TokenFactory.deploy("CryptoEuro", "XEUR", 18);
    ts = getFutureTimeStamp(6);
  });


  it("Should cancel the authorization", async () => {
    const nonce = ethers.randomBytes(32);
    const sig = await getCancelAuthorizationSignature(testToken, owner, owner.address, nonce);
    await testToken.cancelAuthorization(owner.address, nonce, sig.v, sig.r, sig.s);

    expect(await testToken.authorizationState(owner.address, nonce)).to.be.true;
  });

  describe("Testing transfer and before transfer", () => {
    it("Should transfer the token", async () => {
      const nonce = ethers.randomBytes(32);
      const sig = await getTransferAuthorizationSignature(testToken, owner, owner.address, alice.address, oneETH, 0, ts, nonce);
      await testToken.transferWithAuthorization(owner.address, alice.address, oneETH, 0, ts, nonce, sig.v, sig.r, sig.s);

      expect(await testToken.balanceOf(alice.address)).to.equal(oneETH);
    });

    it("Should fail the nonce is canceled", async () => {
      const nonce = ethers.randomBytes(32);
      const sig = await getCancelAuthorizationSignature(testToken, owner, owner.address, nonce);
      await testToken.cancelAuthorization(owner.address, nonce, sig.v, sig.r, sig.s);

      const sig2 = await getTransferAuthorizationSignature(testToken, owner, owner.address, alice.address, oneETH, 0, ts, nonce);

      await expect(testToken.transferWithAuthorization(owner.address, alice.address, oneETH, 0, ts, nonce, sig2.v, sig2.r, sig2.s)).to.be.revertedWith("EIP3009: authorization is used");
    });

    it("Should fail the nonce is used", async () => {
      const nonce = ethers.randomBytes(32);
      const sig = await getTransferAuthorizationSignature(testToken, owner, owner.address, alice.address, oneETH, 0, ts, nonce);
      await testToken.transferWithAuthorization(owner.address, alice.address, oneETH, 0, ts, nonce, sig.v, sig.r, sig.s);

      const sig2 = await getTransferAuthorizationSignature(testToken, owner, owner.address, alice.address, oneETH, 0, ts, nonce);

      await expect(testToken.transferWithAuthorization(owner.address, alice.address, oneETH, 0, ts, nonce, sig2.v, sig2.r, sig2.s)).to.be.revertedWith("EIP3009: authorization is used");
    });
  });
});

