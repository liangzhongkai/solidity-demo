const hre = require("hardhat");

/**
 * Day 2 - 任务 1 演示脚本
 * Mapping 底层 slot 计算的交互式演示
 */
async function main() {
  console.log("\n========== Day 2: Mapping Slot 计算 ==========\n");

  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);

  // 部署合约
  console.log("\n部署 MappingSlot 合约...");
  const MappingSlot = await ethers.getContractFactory("MappingSlot");
  const mappingSlot = await MappingSlot.deploy();
  await mappingSlot.waitForDeployment();
  const contractAddress = await mappingSlot.getAddress();
  console.log("合约地址:", contractAddress);

  // 演示 1: 基础 mapping slot 计算
  console.log("\n--- 演示 1: 基础 Mapping Slot 计算 ---");

  const testAmount = 1234567890;
  await mappingSlot.setBalance(deployer.address, testAmount);
  console.log("设置余额:", testAmount);

  const balance = await mappingSlot.balances(deployer.address);
  console.log("通过 getter 读取余额:", balance.toString());

  // 手动计算 slot
  const mappingSlotNumber = 0; // balances 在 slot 0
  const key = ethers.utils.hexZeroPad(deployer.address, 32);
  const calculatedSlot = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256"],
      [key, mappingSlotNumber]
    )
  );

  console.log("\n🔍 手动计算过程:");
  console.log("  Mapping 变量位置 (slot):", mappingSlotNumber);
  console.log("  用户地址 (padded to 32 bytes):", key);
  console.log("  计算公式: keccak256(abi.encode(key, slot))");
  console.log("  计算结果 slot:", calculatedSlot);

  // 从 storage 直接读取
  const storageValue = await ethers.provider.getStorageAt(
    contractAddress,
    calculatedSlot
  );
  console.log("\n📖 直接从 Storage 读取:");
  console.log("  Storage 值 (hex):", storageValue);
  console.log("  Storage 值 (decimal):", ethers.BigNumber.from(storageValue).toString());

  // 验证一致
  console.log("\n✅ 验证:");
  console.log("  Getter 值:", balance.toString());
  console.log("  Storage 值:", ethers.BigNumber.from(storageValue).toString());
  console.log("  两者一致?", balance.eq(ethers.BigNumber.from(storageValue)));

  // 演示 2: 不同地址产生不同 slot
  console.log("\n--- 演示 2: Mapping 的稀疏存储特性 ---");

  const [_, user2, user3] = await ethers.getSigners();

  const slot2Calc = (address) => {
    const key = ethers.utils.hexZeroPad(address, 32);
    return ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], [key, 0])
    );
  };

  const deployerSlot = slot2Calc(deployer.address);
  const user2Slot = slot2Calc(user2.address);
  const user3Slot = slot2Calc(user3.address);

  console.log("\n不同地址的 balances slot:");
  console.log("  deployer:", deployer.address, "→ slot:", deployerSlot);
  console.log("  user2:   ", user2.address, "→ slot:", user2Slot);
  console.log("  user3:   ", user3.address, "→ slot:", user3Slot);

  console.log("\n这就是为什么 mapping 无法遍历!");
  console.log("  - 不同 key 的 slot 完全分散");
  console.log("  - 无法通过遍历 slot 找到所有数据");

  // 演示 3: Nested mapping
  console.log("\n--- 演示 3: Nested Mapping Slot 计算 ---");

  await mappingSlot.setAllowance(deployer.address, user2.address, 9999);

  const nestedSlotFromContract = await mappingSlot.getNestedAllowanceSlot(
    deployer.address,
    user2.address
  );

  console.log("\nNested mapping: nestedAllowances[owner][spender]");
  console.log("  owner:", deployer.address);
  console.log("  spender:", user2.address);
  console.log("  计算的 slot:", nestedSlotFromContract);

  // 手动计算 nested slot
  const outerSlot = 3; // nestedAllowances 在 slot 3
  const key1 = ethers.utils.hexZeroPad(deployer.address, 32);
  const key2 = ethers.utils.hexZeroPad(user2.address, 32);

  const firstKeccak = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], [key1, outerSlot])
  );

  const secondKeccak = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [key2, firstKeccak])
  );

  console.log("\n🔍 手动计算 nested mapping slot:");
  console.log("  第一步: keccak256(abi.encode(owner, 3))");
  console.log("         =", firstKeccak);
  console.log("  第二步: keccak256(abi.encode(spender, 第一步结果))");
  console.log("         =", secondKeccak);
  console.log("  合约计算:", nestedSlotFromContract);
  console.log("  一致?", nestedSlotFromContract === secondKeccak);

  // 演示 4: 直接操作 storage
  console.log("\n--- 演示 4: 直接操作 Storage Slot ---");

  const targetSlot = calculatedSlot; // deployer 的 balances slot
  const newValue = 55555;

  console.log("\n使用 writeDirectlyToSlot 直接写入 storage...");
  await mappingSlot.writeDirectlyToSlot(targetSlot, newValue);

  const newBalance = await mappingSlot.balances(deployer.address);
  console.log("写入值:", newValue);
  console.log("balances[deployer]:", newBalance.toString());
  console.log("成功修改!", newBalance.toString() === newValue.toString());

  console.log("\n========== 核心要点总结 ==========");
  console.log("1. mapping 的实际存储位置:");
  console.log("   slot = keccak256(abi.encode(key, mapping_slot))");
  console.log("");
  console.log("2. mapping 变量本身只占一个 slot (存储 mapping_slot 编号)");
  console.log("   实际数据存储在计算出的 slot 中");
  console.log("");
  console.log("3. nested mapping 计算:");
  console.log("   slot = keccak256(abi.encode(key2, keccak256(abi.encode(key1, mapping_slot))))");
  console.log("");
  console.log("4. 为什么 mapping 无法遍历:");
  console.log("   - key 被哈希，slot 完全分散");
  console.log("   - 无法从某个 slot 开始递增找到所有数据");
  console.log("   - 解决方案: 记录所有 keys 的数组");
  console.log("=====================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
