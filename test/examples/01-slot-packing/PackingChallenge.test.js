const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PackingChallenge - Slot Packing演示", function () {
  it("应该展示非优化顺序的slot使用情况", async function () {
    const PackingChallenge = await ethers.getContractFactory("PackingChallenge");
    const contract = await PackingChallenge.deploy();

    console.log("\n=== 第一种顺序：uint128 a, uint256 b, uint128 c ===");
    console.log("合约地址:", contract.target);

    // 检查使用的slot数量
    let slotCount = 0;
    let emptySlots = 0;

    for (let i = 0; i < 5; i++) {
      const value = await ethers.provider.getStorage(contract.target, i);
      const BigIntValue = BigInt(value);

      if (BigIntValue !== 0n) {
        slotCount++;
        console.log(`Slot ${i}: ${value} (被占用)`);
      } else {
        emptySlots++;
        if (i <= 3) { // 只显示前4个slot的情况
          console.log(`Slot ${i}: ${value} (空)`);
        }
      }
    }

    console.log(`总计使用了 ${slotCount} 个slot`);
    console.log(`预计Gas成本: ${slotCount * 20000} (每个slot约20,000 Gas)`);

    // 验证变量值
    expect(await contract.a()).to.equal(1);
    expect(await contract.b()).to.equal(2);
    expect(await contract.c()).to.equal(3);
  });

  it("应该展示优化顺序的slot使用情况", async function () {
    const PackingChallengeOptimized = await ethers.getContractFactory("PackingChallengeOptimized");
    const contract = await PackingChallengeOptimized.deploy();

    console.log("\n=== 第二种顺序：uint128 a, uint128 c, uint256 b ===");
    console.log("合约地址:", contract.target);

    // 检查使用的slot数量
    let slotCount = 0;

    for (let i = 0; i < 5; i++) {
      const value = await ethers.provider.getStorage(contract.target, i);
      const BigIntValue = BigInt(value);

      if (BigIntValue !== 0n) {
        slotCount++;
        console.log(`Slot ${i}: ${value} (被占用)`);
      } else {
        if (i <= 2) { // 只显示前3个slot的情况
          console.log(`Slot ${i}: ${value} (空)`);
        }
      }
    }

    console.log(`总计使用了 ${slotCount} 个slot`);
    console.log(`预计Gas成本: ${slotCount * 20000} (每个slot约20,000 Gas)`);

    // 验证变量值
    expect(await contract.a()).to.equal(1);
    expect(await contract.b()).to.equal(2);
    expect(await contract.c()).to.equal(3);
  });

  it("应该直接对比两种顺序的差异", async function () {
    const PackingChallenge = await ethers.getContractFactory("PackingChallenge");
    const contract1 = await PackingChallenge.deploy();

    const PackingChallengeOptimized = await ethers.getContractFactory("PackingChallengeOptimized");
    const contract2 = await PackingChallengeOptimized.deploy();

    console.log("\n=== 直接对比分析 ===");

    // 检查第一个合约的slot使用
    let slots1 = 0;
    for (let i = 0; i < 5; i++) {
      const value = await ethers.provider.getStorage(contract1.target, i);
      if (BigInt(value) !== 0n) slots1++;
    }

    // 检查第二个合约的slot使用
    let slots2 = 0;
    for (let i = 0; i < 5; i++) {
      const value = await ethers.provider.getStorage(contract2.target, i);
      if (BigInt(value) !== 0n) slots2++;
    }

    console.log(`非优化版本使用slots: ${slots1}`);
    console.log(`优化版本使用slots: ${slots2}`);
    console.log(`节省的slots: ${slots1 - slots2}`);
    console.log(`节省的Gas: ${(slots1 - slots2) * 20000}`);

    console.log("\n=== 原因分析 ===");
    console.log("第一种顺序 (uint128 a, uint256 b, uint128 c):");
    console.log("  - Slot 0: uint128 a (16 bytes) + 16 bytes空隙");
    console.log("  - Slot 1: uint256 b (32 bytes) - 完整占用一个slot");
    console.log("  - Slot 2: uint128 c (16 bytes) + 16 bytes空隙");
    console.log("  总计: 3个slot");

    console.log("\n第二种顺序 (uint128 a, uint128 c, uint256 b):");
    console.log("  - Slot 0: uint128 a (16 bytes) + uint128 c (16 bytes) = 32 bytes");
    console.log("  - Slot 1: uint256 b (32 bytes) - 完整占用一个slot");
    console.log("  总计: 2个slot");

    expect(slots1).to.equal(3);
    expect(slots2).to.equal(2);
  });
});