const hre = require("hardhat");

/**
 * Day 2 - 任务 2 演示脚本
 * Proxy + delegatecall 机制
 */
async function main() {
  console.log("\n========== Day 2: Proxy + delegatecall ==========\n");

  const [owner] = await ethers.getSigners();
  console.log("部署账户:", owner.address);

  // 部署逻辑合约 V1
  console.log("\n部署 CounterV1 (逻辑合约)...");
  const CounterV1 = await ethers.getContractFactory("CounterV1");
  const counterV1 = await CounterV1.deploy();
  await counterV1.waitForDeployment();
  const v1Address = await counterV1.getAddress();
  console.log("V1 地址:", v1Address);

  // 部署逻辑合约 V2
  console.log("部署 CounterV2 (升级版本)...");
  const CounterV2 = await ethers.getContractFactory("CounterV2");
  const counterV2 = await CounterV2.deploy();
  await counterV2.waitForDeployment();
  const v2Address = await counterV2.getAddress();
  console.log("V2 地址:", v2Address);

  // 部署 Proxy，指向 V1
  console.log("\n部署 Proxy (指向 V1)...");
  const Proxy = await ethers.getContractFactory("Proxy");
  const proxy = await Proxy.deploy(v1Address, owner.address);
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  console.log("Proxy 地址:", proxyAddress);

  // 创建接口
  const counter = await ethers.getContractAt("CounterV1", proxyAddress);

  // 演示 1: 基础操作
  console.log("\n--- 演示 1: 基础操作 (V1) ---");

  await counter.initialize(owner.address);
  console.log("初始化完成，owner:", owner.address);

  await counter.increment();
  await counter.increment();
  await counter.incrementBy(10);

  let count = await counter.getCount();
  let version = await counter.getVersion();

  console.log("\n📊 当前状态:");
  console.log("  Count:", count.toString());
  console.log("  Version:", version);

  // 直接读取 storage
  const slot3 = await ethers.provider.getStorageAt(proxyAddress, 3);
  console.log("\n📦 Proxy Storage Slot 3 (count):", ethers.BigNumber.from(slot3).toString());

  // 演示 2: 验证 V1 合约本身的状态没变
  console.log("\n--- 演示 2: delegatecall 语义 ---");
  const v1Count = await counterV1.getCount();
  console.log("Proxy 上的 count:", count.toString());
  console.log("V1 合约上的 count:", v1Count.toString());
  console.log("结论: 代码在 V1 执行，但 storage 在 Proxy!");

  // 演示 3: 升级到 V2
  console.log("\n--- 演示 3: 升级到 V2 ---");

  console.log("\n升级前:");
  console.log("  Impl 地址:", await proxy.impl());
  console.log("  Count:", count.toString());
  console.log("  Version:", version);

  console.log("\n执行 upgrade...");
  const tx = await proxy.upgrade(v2Address);
  await tx.wait();

  console.log("升级完成!");

  // 切换到 V2 接口
  const counterV2 = await ethers.getContractAt("CounterV2", proxyAddress);

  console.log("\n升级后:");
  console.log("  Impl 地址:", await proxy.impl());
  const newCount = await counterV2.getCount();
  const newVersion = await counterV2.getVersion();
  console.log("  Count:", newCount.toString());
  console.log("  Version:", newVersion);

  console.log("\n✅ 数据保留了! Count 仍然是", newCount.toString());

  // 演示 4: V2 新功能
  console.log("\n--- 演示 4: V2 新功能 ---");

  await counterV2.multiply(2);
  const multipliedCount = await counterV2.getCount();
  console.log("执行 multiply(2) 后, count:", multipliedCount.toString());

  await counterV2.add(100);
  const addedCount = await counterV2.getCount();
  console.log("执行 add(100) 后, count:", addedCount.toString());

  const stats = await counterV2.getStats();
  console.log("\n📊 V2 统计信息:");
  console.log("  Count:", stats._count.toString());
  console.log("  Total Operations:", stats._totalOps.toString());
  console.log("  Last Updated:", new Date(stats._lastUpdated.toNumber() * 1000).toLocaleString());

  // 演示 5: Storage 布局
  console.log("\n--- 演示 5: Storage 布局验证 ---");

  const slot4 = await ethers.provider.getStorageAt(proxyAddress, 4);
  const slot5 = await ethers.provider.getStorageAt(proxyAddress, 5);
  const slot6 = await ethers.provider.getStorageAt(proxyAddress, 6);

  console.log("\n📦 Proxy Storage 布局:");
  console.log("  Slot 0 (impl):", await proxy.impl());
  console.log("  Slot 1 (admin):", await proxy.admin());
  console.log("  Slot 2 (PROXY_ID):", ethers.BigNumber.from(await ethers.provider.getStorageAt(proxyAddress, 2)).toString());
  console.log("  Slot 3 (count):", ethers.BigNumber.from(slot3).toString());
  console.log("  Slot 4 (owner):", ethers.utils.getAddress(ethers.utils.hexDataSlice(slot4, 12)));
  console.log("  Slot 5 (lastUpdated):", ethers.BigNumber.from(slot5).toString());
  console.log("  Slot 6 (totalOperations - V2 新增):", ethers.BigNumber.from(slot6).toString());

  console.log("\n========== 核心要点总结 ==========");
  console.log("1. delegatecall 本质:");
  console.log("   - 代码在 impl 合约执行");
  console.log("   - 但存储在 Proxy 合约");
  console.log("   - msg.sender 保持为原始调用者");
  console.log("");
  console.log("2. 可升级合约原理:");
  console.log("   - Storage 永远在 Proxy");
  console.log("   - 逻辑在 impl 合约");
  console.log("   - 修改 impl 地址 = 升级合约");
  console.log("");
  console.log("3. Storage 布局兼容性:");
  console.log("   - 只能追加新变量");
  console.log("   - 不能改变现有变量顺序");
  console.log("   - 不能删除现有变量");
  console.log("   - 否则会导致数据混乱!");
  console.log("====================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
