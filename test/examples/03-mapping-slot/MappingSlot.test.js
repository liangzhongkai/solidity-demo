const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper function for hardhat-ethers v6
async function getStorageAt(address, slot) {
  return await ethers.provider.send("eth_getStorageAt", [address, slot, "latest"]);
}

async function getBalance(address) {
  return await ethers.provider.send("eth_getBalance", [address, "latest"]);
}

/**
 * Day 2 - 任务 1: Mapping 底层 slot 计算
 *
 * 核心概念：
 * mapping(keyType => valueType) varName;
 *
 * storage slot 计算：
 * slot = keccak256(abi.encode(key, mapping_slot))
 *
 * 这个测试让你亲眼看到 slot 地址的计算过程
 */
describe("MappingSlot - 底层存储槽计算", function () {
  let mappingSlot;
  let user1, user2;

  beforeEach(async function () {
    [user1, user2] = await ethers.getSigners();

    const MappingSlot = await ethers.getContractFactory("MappingSlot");
    mappingSlot = await MappingSlot.deploy();
    await mappingSlot.waitForDeployment();
  });

  describe("任务 1.1: 基础 mapping slot 计算", function () {
    it("应该演示 balances mapping (slot 0) 的 slot 计算", async function () {
      const contractAddress = await mappingSlot.getAddress();

      // balances mapping 在合约的 slot 0
      const mappingSlotNumber = 0;

      // 设置余额
      const testAmount = 12345;
      await mappingSlot.setBalance(user1.address, testAmount);

      // 方法1: 通过合约的 getter 读取
      const balanceViaGetter = await mappingSlot.balances(user1.address);
      expect(balanceViaGetter).to.equal(testAmount);

      // 方法2: 手动计算 slot 并直接从 storage 读取
      // 这是关键！理解 mapping 在 storage 中的真正存储方式
      const key = ethers.zeroPadValue(user1.address, 32);
      const calculatedSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "uint256"],
          [key, mappingSlotNumber]
        )
      );

      console.log("\n========== Mapping Slot 计算演示 ==========");
      console.log("合约地址:", contractAddress);
      console.log("用户地址:", user1.address);
      console.log("Mapping 在 slot:", mappingSlotNumber);
      console.log("Padded key (32 bytes):", key);
      console.log("计算的 slot:", calculatedSlot);
      console.log("==========================================\n");

      // 直接从 storage 读取，验证计算正确
      const storageValue = await getStorageAt(contractAddress, calculatedSlot);
      const parsedValue = BigInt(storageValue);

      expect(parsedValue).to.equal(BigInt(testAmount));
      expect(parsedValue).to.equal(BigInt(balanceViaGetter));

      console.log("✅ 验证成功!");
      console.log("   - getter 返回值:", balanceViaGetter.toString());
      console.log("   - storage 读取值:", parsedValue.toString());
    });

    it("应该演示 getBalanceSlot() 函数", async function () {
      const contractAddress = await mappingSlot.getAddress();

      // 通过合约函数计算 slot
      const slotFromContract = await mappingSlot.getBalanceSlot(user1.address);

      // 手动计算 slot
      const key = ethers.zeroPadValue(user1.address, 32);
      const calculatedSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "uint256"],
          [key, 0] // balances 在 slot 0
        )
      );

      expect(slotFromContract).to.equal(calculatedSlot);

      console.log("\n========== getBalanceSlot() 测试 ==========");
      console.log("用户地址:", user1.address);
      console.log("合约计算的 slot:", slotFromContract);
      console.log("手动计算的 slot:", calculatedSlot);
      console.log("两者一致:", slotFromContract === calculatedSlot);
      console.log("===========================================\n");

      // 设置余额并验证
      const testAmount = 99999;
      await mappingSlot.setBalance(user1.address, testAmount);

      const storageValue = await getStorageAt(contractAddress, slotFromContract);
      expect(BigInt(storageValue)).to.equal(BigInt(testAmount));
    });

    it("应该演示 allowances mapping (slot 1) 的 slot 计算", async function () {
      const contractAddress = await mappingSlot.getAddress();

      // allowances mapping 在合约的 slot 1
      const mappingSlotNumber = 1;

      const testAmount = 99999;
      await mappingSlot.setAllowance(user1.address, user2.address, testAmount);

      // 通过合约函数计算 slot
      const slotFromContract = await mappingSlot.getAllowanceSlot(user2.address);

      // 手动计算 slot
      const key = ethers.zeroPadValue(user2.address, 32);
      const calculatedSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "uint256"],
          [key, mappingSlotNumber]
        )
      );

      expect(slotFromContract).to.equal(calculatedSlot);

      console.log("\n========== Allowances Mapping Slot ==========");
      console.log("合约计算的 slot:", slotFromContract);
      console.log("手动计算的 slot:", calculatedSlot);
      console.log("两者一致:", slotFromContract === calculatedSlot);
      console.log("=============================================\n");

      // 验证 storage 值
      const storageValue = await getStorageAt(contractAddress, calculatedSlot);
      const parsedValue = BigInt(storageValue);
      expect(parsedValue).to.equal(BigInt(testAmount));
    });
  });

  describe("任务 1.2: Nested mapping slot 计算", function () {
    it("应该演示 nested mapping 的 slot 计算", async function () {
      const contractAddress = await mappingSlot.getAddress();

      // nestedAllowances 在 slot 3
      const outerMappingSlot = 3;

      const testAmount = 55555;
      await mappingSlot.setAllowance(user1.address, user2.address, testAmount);

      // 通过合约函数计算
      const slotFromContract = await mappingSlot.getNestedAllowanceSlot(
        user1.address,
        user2.address
      );

      // 手动计算 nested mapping slot
      // 公式: keccak256(abi.encode(key2, keccak256(abi.encode(key1, slot))))
      const key1 = ethers.zeroPadValue(user1.address, 32);
      const key2 = ethers.zeroPadValue(user2.address, 32);

      const outerSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "uint256"],
          [key1, outerMappingSlot]
        )
      );

      const finalSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "bytes32"],
          [key2, outerSlot]
        )
      );

      console.log("\n========== Nested Mapping Slot 计算 ==========");
      console.log("外层 key (owner):", user1.address);
      console.log("内层 key (spender):", user2.address);
      console.log("外层 mapping slot:", outerMappingSlot);
      console.log("第一层 keccak256:", outerSlot);
      console.log("最终 slot:", finalSlot);
      console.log("合约计算结果:", slotFromContract);
      console.log("计算一致:", slotFromContract === finalSlot);
      console.log("================================================\n");

      expect(slotFromContract).to.equal(finalSlot);

      // 验证 storage 值
      const storageValue = await getStorageAt(contractAddress, finalSlot);
      const parsedValue = BigInt(storageValue);
      expect(parsedValue).to.equal(BigInt(testAmount));
    });
  });

  describe("任务 1.3: 直接操作 storage slot", function () {
    it("应该演示直接写入和读取 storage slot", async function () {
      const contractAddress = await mappingSlot.getAddress();

      // 计算 user1 的 balances slot
      const key = ethers.zeroPadValue(user1.address, 32);
      const targetSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "uint256"],
          [key, 0] // balances 在 slot 0
        )
      );

      const testValue = 88888;

      // 方法1: 使用合约的 writeDirectlyToSlot 函数
      await mappingSlot.writeDirectlyToSlot(targetSlot, testValue);

      // 验证 balances[user1] 确实被修改了
      const balance = await mappingSlot.balances(user1.address);
      expect(balance).to.equal(testValue);

      console.log("\n========== 直接 Storage 操作 ==========");
      console.log("目标 slot:", targetSlot);
      console.log("写入值:", testValue);
      console.log("balances[user1]:", balance.toString());
      console.log("======================================\n");

      // 方法2: 使用合约的 readDirectlyFromSlot 函数
      const directRead = await mappingSlot.readDirectlyFromSlot(targetSlot);
      expect(directRead).to.equal(testValue);

      // 方法3: 使用 provider.getStorageAt
      const providerRead = await getStorageAt(contractAddress, targetSlot);
      expect(BigInt(providerRead)).to.equal(BigInt(testValue));
    });
  });

  describe("关键理解: 为什么 mapping 不能遍历", function () {
    it("应该演示 mapping 数据的稀疏存储特性", async function () {
      // 设置两个不同地址的余额
      await mappingSlot.setBalance(user1.address, 1000);
      await mappingSlot.setBalance(user2.address, 2000);

      // 计算各自的 slot
      const key1 = ethers.zeroPadValue(user1.address, 32);
      const slot1 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [key1, 0])
      );

      const key2 = ethers.zeroPadValue(user2.address, 32);
      const slot2 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [key2, 0])
      );

      console.log("\n========== Mapping 稀疏存储特性 ==========");
      console.log("user1 slot:", slot1);
      console.log("user2 slot:", slot2);
      console.log("两个 slot 相邻吗?", slot1 == slot2);
      console.log("slot 数值差距:", BigInt(slot2) - BigInt(slot1));
      console.log("===========================================\n");

      // 两个地址的 slot 完全不同，且不相邻
      // 这就是为什么 mapping 无法遍历：你不知道哪些 key 被使用了
      expect(slot1).to.not.equal(slot2);

      // 创建一个新的 mapping 合约实例来测试未使用的地址
      const MappingSlot = await ethers.getContractFactory("MappingSlot");
      const freshMappingSlot = await MappingSlot.deploy();
      await freshMappingSlot.waitForDeployment();

      // 使用一个从未设置过的地址
      const [_, __, randomUser] = await ethers.getSigners();
      const key3 = ethers.zeroPadValue(randomUser.address, 32);
      const slot3 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [key3, 0])
      );
      const value = await getStorageAt(
        await freshMappingSlot.getAddress(),
        slot3
      );
      expect(BigInt(value)).to.equal(0n);
    });
  });
});
