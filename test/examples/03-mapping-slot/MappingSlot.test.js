const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper function for hardhat-ethers v6
async function getStorageAt(address, slot) {
  return await ethers.provider.send("eth_getStorageAt", [address, slot, "latest"]);
}

// 格式化 uint256 为 storage 中的 32 字节 hex 格式（用于 expect 精确匹配）
function toStorageHex(value) {
  return ethers.toBeHex(BigInt(value), 32);
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
    it("mapping slot computed correctly", async function () {
      const slotIndex = 0; // balances mapping 在 slot 0
      const testAmount = 12345;
      await mappingSlot.setBalance(user1.address, testAmount);

      const key = ethers.zeroPadValue(user1.address, 32);
      const slot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [key, slotIndex])
      );
      const expectedValue = toStorageHex(testAmount);
      expect(await getStorageAt(await mappingSlot.getAddress(), slot)).to.equal(expectedValue);
    });

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

      // 关键断言：用计算出的 slot 直接从 storage 读取，验证理解正确
      const expectedValue = toStorageHex(testAmount);
      expect(await getStorageAt(contractAddress, calculatedSlot)).to.equal(expectedValue);

      console.log("✅ 验证成功!");
      console.log("   - getter 返回值:", balanceViaGetter.toString());
      console.log("   - expect(provider.getStorageAt(addr, computedSlot)).to.equal(expectedValue) ✓");
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

      // 显式断言：computedSlot 与 storage 值一一对应
      expect(await getStorageAt(contractAddress, slotFromContract)).to.equal(toStorageHex(testAmount));
    });

    it("应该对比不同 address 的 slot，验证 EVM 布局一致性", async function () {
      const contractAddress = await mappingSlot.getAddress();
      const mappingSlotNumber = 0; // balances 在 slot 0

      // 为多个地址设置不同余额
      const [addr1, addr2] = [user1.address, user2.address];
      const [amount1, amount2] = [11111, 22222];
      await mappingSlot.setBalance(addr1, amount1);
      await mappingSlot.setBalance(addr2, amount2);

      // 对每个 address：计算 slot = keccak256(abi.encode(key, mapping_slot))
      const computeSlot = (addr) => {
        const key = ethers.zeroPadValue(addr, 32);
        return ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [key, mappingSlotNumber])
        );
      };

      const slot1 = computeSlot(addr1);
      const slot2 = computeSlot(addr2);

      // 验证：不同 address → 不同 slot
      expect(slot1).to.not.equal(slot2);

      // 关键断言：expect(provider.getStorageAt(addr, computedSlot)).to.equal(expectedValue)
      expect(await getStorageAt(contractAddress, slot1)).to.equal(toStorageHex(amount1));
      expect(await getStorageAt(contractAddress, slot2)).to.equal(toStorageHex(amount2));

      console.log("\n========== 多地址 Slot 对比验证 ==========");
      console.log("addr1:", addr1, "→ slot:", slot1, "→ value:", amount1);
      console.log("addr2:", addr2, "→ slot:", slot2, "→ value:", amount2);
      console.log("公式 slot = keccak256(abi.encode(key, 0)) 对任意 address 均成立 ✓");
      console.log("============================================\n");
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

      // 关键断言：用计算出的 slot 读 storage
      expect(await getStorageAt(contractAddress, calculatedSlot)).to.equal(toStorageHex(testAmount));

      console.log("\n========== Allowances Mapping Slot ==========");
      console.log("合约计算的 slot:", slotFromContract);
      console.log("手动计算的 slot:", calculatedSlot);
      console.log(" expect(provider.getStorageAt(addr, computedSlot)).to.equal(expectedValue) ✓");
      console.log("=============================================\n");
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

      // 关键断言：nested mapping 的 slot 计算正确，storage 值一致
      expect(await getStorageAt(contractAddress, finalSlot)).to.equal(toStorageHex(testAmount));
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

      // 方法3: 显式 assert - expect(provider.getStorageAt(addr, computedSlot)).to.equal(expectedValue)
      expect(await getStorageAt(contractAddress, targetSlot)).to.equal(toStorageHex(testValue));
    });
  });

  describe("关键理解: 为什么 mapping 不能遍历", function () {
    it("应该演示 mapping 数据的稀疏存储特性", async function () {
      const contractAddress = await mappingSlot.getAddress();

      // 设置两个不同地址的余额
      await mappingSlot.setBalance(user1.address, 1000);
      await mappingSlot.setBalance(user2.address, 2000);

      // 计算各自的 slot = keccak256(abi.encode(key, mapping_slot))
      const key1 = ethers.zeroPadValue(user1.address, 32);
      const slot1 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [key1, 0])
      );

      const key2 = ethers.zeroPadValue(user2.address, 32);
      const slot2 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [key2, 0])
      );

      // 关键断言：不同 address 对应不同 slot，各自 storage 值正确
      expect(slot1).to.not.equal(slot2);
      expect(await getStorageAt(contractAddress, slot1)).to.equal(toStorageHex(1000));
      expect(await getStorageAt(contractAddress, slot2)).to.equal(toStorageHex(2000));

      console.log("\n========== Mapping 稀疏存储特性 ==========");
      console.log("user1 slot:", slot1, "→ value: 1000");
      console.log("user2 slot:", slot2, "→ value: 2000");
      console.log("两个 slot 完全不同，且不相邻");
      console.log(" expect(provider.getStorageAt(addr, computedSlot)).to.equal(expectedValue) ✓");
      console.log("===========================================\n");

      // 未使用的 address：computedSlot 对应 storage 为 0
      const [_, __, randomUser] = await ethers.getSigners();
      const key3 = ethers.zeroPadValue(randomUser.address, 32);
      const slot3 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [key3, 0])
      );
      expect(await getStorageAt(contractAddress, slot3)).to.equal(toStorageHex(0));
    });
  });
});
