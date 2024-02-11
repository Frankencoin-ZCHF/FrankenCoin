import * as helper from "@nomicfoundation/hardhat-network-helpers";

export const evm_increaseTime = async (seconds: number | bigint) => {
  await helper.time.increase(seconds);
  await helper.mine(1);
};

export const evm_mine_blocks = async (n: number) => {
  await helper.mine(n);
};
