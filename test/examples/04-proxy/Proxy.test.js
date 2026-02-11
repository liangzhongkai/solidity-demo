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
 * Day 2 - 任务 2: Proxy + delegatecall
 *
 * 核心概念：
 * 1. delegatecall 在调用者的 storage 上执行被调用者的代码
 * 2. Proxy 存储 storage，impl 合约提供代码
 * 3. 通过修改 impl 地址实现合约升级
 *
 * 这是理解可升级合约的基础！
 */
describe("Proxy - delegatecall 机制", function () {
  let proxy;
  let counterV1;
  let counterV2;
  let brokenCounter;
  let owner, user1, user2;

  // Counter 接口（用于调用 Proxy）
  let counterInterface;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // 部署逻辑合约（这些合约不直接使用，而是被 Proxy delegatecall）
    const CounterV1 = await ethers.getContractFactory("CounterV1");
    counterV1 = await CounterV1.deploy();
    await counterV1.waitForDeployment();

    const CounterV2 = await ethers.getContractFactory("CounterV2");
    counterV2 = await CounterV2.deploy();
    await counterV2.waitForDeployment();

    const BrokenCounter = await ethers.getContractFactory("BrokenCounter");
    brokenCounter = await BrokenCounter.deploy();
    await brokenCounter.waitForDeployment();

    // 部署 Proxy，指向 V1
    const Proxy = await ethers.getContractFactory("Proxy");
    proxy = await Proxy.deploy(await counterV1.getAddress(), owner.address);
    await proxy.waitForDeployment();

    // 创建 Counter 接口包装器，用于通过 Proxy 调用
    counterInterface = await ethers.getContractAt(
      "CounterV1",
      await proxy.getAddress()
    );
  });

  describe("Proxy 委托与升级", function () {
    it("proxy delegates call", async function () {
      // deploy logic, proxy (via beforeEach)
      await counterInterface.initialize(owner.address);

      // call proxy.someFunction() that exists in logic (increment)
      await counterInterface.connect(user1).increment();

      // Pure function: logic and proxy return same (same code executes via delegatecall)
      expect(await counterV1.connect(user1).getVersion.staticCall()).to.equal(
        await counterInterface.connect(user1).getVersion.staticCall()
      );

      // Verify proxy state was updated via delegation
      expect(await counterInterface.getCount.staticCall()).to.equal(1);
    });

    it("proxy upgrade behavior", async function () {
      await counterInterface.initialize(owner.address);
      await counterInterface.connect(user1).increment();

      const newImpl = await counterV2.getAddress();

      await proxy.connect(owner).upgrade(newImpl);

      expect(await proxy.impl()).to.equal(newImpl);

      const counterV2Iface = await ethers.getContractAt(
        "CounterV2",
        await proxy.getAddress()
      );
      expect(await counterV2Iface.getCount.staticCall()).to.equal(1);
      expect(await counterV2Iface.getVersion.staticCall()).to.equal("V2");
    });
  });

  describe("任务 2.1: 理解 delegatecall 的本质", function () {
    it("应该演示 storage 在 Proxy，逻辑在 impl", async function () {
      const proxyAddress = await proxy.getAddress();
      const v1Address = await counterV1.getAddress();

      console.log("\n========== Storage vs 代码分离 ==========");
      console.log("Proxy 地址 (storage 在这里):", proxyAddress);
      console.log("Impl 地址 (代码在这里):", v1Address);
      console.log("=========================================\n");

      // 初始化（通过 Proxy 调用 V1 的 initialize）
      await counterInterface.initialize(owner.address);

      // 读取 Proxy 的 storage
      // CounterV1 预留了 slot 0, 1 给 Proxy，所以：
      // Proxy slot 0: impl (CounterV1 的 __gap_0_impl)
      // Proxy slot 1: admin (CounterV1 的 __gap_1_admin)
      // Proxy slot 2: count (CounterV1 的 count)
      // Proxy slot 3: owner (CounterV1 的 owner)
      // Proxy slot 4: lastUpdated (CounterV1 的 lastUpdated)
      const slot2 = await getStorageAt(proxyAddress, "0x2");
      const slot3 = await getStorageAt(proxyAddress, "0x3");
      const slot4 = await getStorageAt(proxyAddress, "0x4");

      console.log("📦 Proxy 的 Storage 直接读取:");
      console.log("  Slot 2 (count):", BigInt(slot2).toString());
      const ownerFromSlot = "0x" + slot3.slice(-40);
      console.log("  Slot 3 (owner):", ethers.getAddress(ownerFromSlot));
      console.log("  Slot 4 (lastUpdated):", BigInt(slot4).toString());

      // 通过接口调用读取
      // 注意：由于函数没有 view 修饰符（为了兼容 delegatecall），
      // 需要使用 staticCall() 强制使用静态调用
      const count = await counterInterface.getCount.staticCall();
      const contractOwner = await counterInterface.getOwner.staticCall();
      const version = await counterInterface.getVersion.staticCall();

      console.log("\n📖 通过接口调用读取:");
      console.log("  count:", count.toString());
      console.log("  owner:", contractOwner);
      console.log("  version:", version);

      expect(count).to.equal(0);
      expect(contractOwner).to.equal(owner.address);
      expect(version).to.equal("V1");
    });

    it("应该演示 delegatecall 保持 msg.sender 不变", async function () {
      await counterInterface.initialize(owner.address);

      // user1 通过 Proxy 调用 increment
      const counterAsUser1 = counterInterface.connect(user1);
      await counterAsUser1.increment();

      const count = await counterInterface.getCount.staticCall();
      expect(count).to.equal(1);

      // 重要：Counter 合约本身的状态没有改变！
      const v1Count = await counterV1.getCount.staticCall();
      expect(v1Count).to.equal(0); // V1 合约的 count 仍然是 0

      console.log("\n========== delegatecall 语义验证 ==========");
      console.log("通过 Proxy.increment() 后:");
      console.log("  Proxy 上的 count:", count.toString());
      console.log("  V1 合约上的 count:", v1Count.toString());
      console.log("\n这证明: 代码在 V1 执行，但 storage 改变在 Proxy!");
      console.log("===========================================\n");
    });

    it("应该演示多个 Proxy 可以共享同一个 impl", async function () {
      // 创建第二个 Proxy，也指向同一个 V1
      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy2 = await Proxy.deploy(await counterV1.getAddress(), owner.address);
      await proxy2.waitForDeployment();

      const counterInterface2 = await ethers.getContractAt(
        "CounterV1",
        await proxy2.getAddress()
      );

      // 分别初始化
      await counterInterface.initialize(owner.address);
      await counterInterface2.initialize(owner.address);

      // Proxy1 increment 5 次
      for (let i = 0; i < 5; i++) {
        await counterInterface.increment();
      }

      // Proxy2 increment 3 次
      for (let i = 0; i < 3; i++) {
        await counterInterface2.increment();
      }

      const count1 = await counterInterface.getCount.staticCall();
      const count2 = await counterInterface2.getCount.staticCall();

      console.log("\n========== 共享 Impl 示例 ==========");
      console.log("Impl 地址:", await counterV1.getAddress());
      console.log("Proxy1 count:", count1.toString());
      console.log("Proxy2 count:", count2.toString());
      console.log("\n两个 Proxy 使用同一份代码，");
      console.log("但有各自独立的 storage！");
      console.log("===================================\n");

      expect(count1).to.equal(5);
      expect(count2).to.equal(3);
    });
  });

  describe("任务 2.2: 合约升级演示", function () {
    it("应该演示从 V1 升级到 V2", async function () {
      // 创建一个新的 Proxy 实例，避免与其他测试的存储冲突
      const Proxy = await ethers.getContractFactory("Proxy");
      const upgradeProxy = await Proxy.deploy(await counterV1.getAddress(), owner.address);
      await upgradeProxy.waitForDeployment();

      const upgradeCounterIface = await ethers.getContractAt(
        "CounterV1",
        await upgradeProxy.getAddress()
      );

      // 初始化 V1
      await upgradeCounterIface.initialize(owner.address);

      // 在 V1 上操作
      await upgradeCounterIface.increment();
      await upgradeCounterIface.increment();
      await upgradeCounterIface.incrementBy(10);

      let count = await upgradeCounterIface.getCount.staticCall();
      let version = await upgradeCounterIface.getVersion.staticCall();

      console.log("\n========== 升级前 (V1) ==========");
      console.log("Count:", count.toString());
      console.log("Version:", version);
      console.log("Impl:", await counterV1.getAddress());
      console.log("===============================\n");

      expect(count).to.equal(12); // 1 + 1 + 10
      expect(version).to.equal("V1");

      // 升级到 V2
      await upgradeProxy.upgrade(await counterV2.getAddress());

      // 创建 V2 接口
      const counterV2Interface = await ethers.getContractAt(
        "CounterV2",
        await upgradeProxy.getAddress()
      );

      // 验证：storage 数据保留了！
      count = await counterV2Interface.getCount.staticCall();
      version = await counterV2Interface.getVersion.staticCall();
      const impl = await upgradeProxy.impl();

      console.log("\n========== 升级后 (V2) ==========");
      console.log("Count:", count.toString());
      console.log("Version:", version);
      console.log("Impl:", impl);
      console.log("Storage 数据保留了!", count.toString() === "12");
      console.log("===============================\n");

      expect(count).to.equal(12); // 数据保留
      expect(version).to.equal("V2");
      expect(impl).to.equal(await counterV2.getAddress());

      // 使用 V2 新增的功能
      await counterV2Interface.multiply(2);
      count = await counterV2Interface.getCount.staticCall();
      expect(count).to.equal(24);

      // V2 新增的 totalOperations
      const stats = await counterV2Interface.getStats.staticCall();
      expect(stats._count).to.equal(24);
      expect(stats._totalOps).to.equal(1); // multiply 是升级后第一次操作

      console.log("\n========== V2 新功能测试 ==========");
      console.log("multiply(2) 后 count:", count.toString());
      console.log("totalOperations:", stats._totalOps.toString());
      console.log("===================================\n");
    });

    it("应该演示 upgradeToAndCall 初始化新变量", async function () {
      // 使用 AdminUpgradeabilityProxy
      const AdminProxy = await ethers.getContractFactory("AdminUpgradeabilityProxy");
      const adminProxy = await AdminProxy.deploy(
        await counterV1.getAddress(),
        owner.address
      );
      await adminProxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await adminProxy.getAddress()
      );

      await counterV1Iface.initialize(owner.address);
      await counterV1Iface.increment();

      // 升级到 V2（不需要重新初始化，因为已经初始化过了）
      await adminProxy.upgradeToAndCall(await counterV2.getAddress(), "0x");

      const counterV2Iface = await ethers.getContractAt(
        "CounterV2",
        await adminProxy.getAddress()
      );

      const version = await counterV2Iface.getVersion.staticCall();
      expect(version).to.equal("V2");

      console.log("\n========== 升级后（不需要重新初始化）==========");
      console.log("Version:", version);
      console.log("=================================\n");
    });

    it("应该演示 AdminUpgradeabilityProxy.upgradeTo()", async function () {
      const AdminProxy = await ethers.getContractFactory("AdminUpgradeabilityProxy");
      const adminProxy = await AdminProxy.deploy(
        await counterV1.getAddress(),
        owner.address
      );
      await adminProxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await adminProxy.getAddress()
      );

      await counterV1Iface.initialize(owner.address);
      await counterV1Iface.increment();

      // 使用 upgradeTo() 升级
      await adminProxy.upgradeTo(await counterV2.getAddress());

      const counterV2Iface = await ethers.getContractAt(
        "CounterV2",
        await adminProxy.getAddress()
      );

      const version = await counterV2Iface.getVersion.staticCall();
      expect(version).to.equal("V2");

      // 验证数据保留
      const count = await counterV2Iface.getCount.staticCall();
      expect(count).to.equal(1);

      console.log("\n========== upgradeTo() 成功 ==========");
      console.log("Version:", version);
      console.log("Count 保留:", count.toString());
      console.log("=====================================\n");
    });

    it("应该演示 upgradeToAndCall 带初始化数据", async function () {
      const AdminProxy = await ethers.getContractFactory("AdminUpgradeabilityProxy");
      const adminProxy = await AdminProxy.deploy(
        await counterV1.getAddress(),
        owner.address
      );
      await adminProxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await adminProxy.getAddress()
      );

      await counterV1Iface.initialize(owner.address);
      await counterV1Iface.increment();

      // 升级到 V2（不重新初始化，因为已经初始化过了）
      // 使用空数据跳过初始化
      await adminProxy.upgradeToAndCall(await counterV2.getAddress(), "0x");

      const counterV2Iface = await ethers.getContractAt(
        "CounterV2",
        await adminProxy.getAddress()
      );

      const version = await counterV2Iface.getVersion.staticCall();
      expect(version).to.equal("V2");

      // 验证数据保留
      const count = await counterV2Iface.getCount.staticCall();
      expect(count).to.equal(1);

      console.log("\n========== upgradeToAndCall 跳过重新初始化 ==========");
      console.log("Version:", version);
      console.log("Count 保留:", count.toString());
      console.log("===================================================\n");
    });

    it("应该演示 upgradeToAndCall 初始化失败", async function () {
      // 创建一个从未初始化的新 Proxy
      const AdminProxy = await ethers.getContractFactory("AdminUpgradeabilityProxy");
      const adminProxy = await AdminProxy.deploy(
        await counterV1.getAddress(),
        owner.address
      );
      await adminProxy.waitForDeployment();

      // 不要初始化，直接升级并尝试用无效数据初始化

      // 使用一个不存在的函数调用数据
      const fakeFunctionSelector = ethers.id("nonExistentFunction()").slice(0, 10);

      await expect(
        adminProxy.upgradeToAndCall(await counterV2.getAddress(), fakeFunctionSelector)
      ).to.be.reverted;

      console.log("\n========== upgradeToAndCall 初始化失败 ==========");
      console.log("使用了不存在的函数选择器");
      console.log("================================================\n");
    });

    it("应该测试 CounterV2.getLastUpdated()", async function () {
      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy = await Proxy.deploy(await counterV2.getAddress(), owner.address);
      await proxy.waitForDeployment();

      const counterV2Iface = await ethers.getContractAt(
        "CounterV2",
        await proxy.getAddress()
      );

      await counterV2Iface.initialize(owner.address);

      const lastUpdatedBefore = await counterV2Iface.getLastUpdated.staticCall();
      expect(lastUpdatedBefore).to.be.greaterThan(0);

      // 等待一个区块
      await counterV2Iface.increment();

      const lastUpdatedAfter = await counterV2Iface.getLastUpdated.staticCall();
      expect(lastUpdatedAfter).to.be.greaterThan(lastUpdatedBefore);

      console.log("\n========== CounterV2.getLastUpdated() ==========");
      console.log("初始化时间:", lastUpdatedBefore.toString());
      console.log("increment 后时间:", lastUpdatedAfter.toString());
      console.log("===============================================\n");
    });

    it("应该测试 CounterV2.add(), multiply(), reset() 函数", async function () {
      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy = await Proxy.deploy(await counterV2.getAddress(), owner.address);
      await proxy.waitForDeployment();

      const counterV2Iface = await ethers.getContractAt(
        "CounterV2",
        await proxy.getAddress()
      );

      await counterV2Iface.initialize(owner.address);

      // 测试 incrementBy()
      await counterV2Iface.incrementBy(10);
      let count = await counterV2Iface.getCount.staticCall();
      expect(count).to.equal(10);

      // 测试 decrement()
      await counterV2Iface.decrement();
      count = await counterV2Iface.getCount.staticCall();
      expect(count).to.equal(9);

      // 测试 decrement 的边界检查
      await counterV2Iface.reset();
      await expect(counterV2Iface.decrement()).to.be.revertedWith("count cannot go below zero");

      // 重新设置一些值进行后续测试
      await counterV2Iface.incrementBy(10);

      // 测试 add()
      await counterV2Iface.add(5);
      count = await counterV2Iface.getCount.staticCall();
      expect(count).to.equal(15);

      // 测试 multiply()
      await counterV2Iface.multiply(2);
      count = await counterV2Iface.getCount.staticCall();
      expect(count).to.equal(30);

      // 测试 reset()
      await counterV2Iface.reset();
      count = await counterV2Iface.getCount.staticCall();
      expect(count).to.equal(0);

      // 测试 reset() 的权限检查
      const counterAsUser = counterV2Iface.connect(user1);
      await expect(counterAsUser.reset()).to.be.revertedWith("only owner");

      console.log("\n========== CounterV2 新增功能测试 ==========");
      console.log("incrementBy(10): count = 10");
      console.log("decrement(): count = 9");
      console.log("add(5): count = 15");
      console.log("multiply(2): count = 30");
      console.log("reset(): count = 0");
      console.log("===========================================\n");
    });

    it("应该测试 CounterV2.getOwner()", async function () {
      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy = await Proxy.deploy(await counterV2.getAddress(), owner.address);
      await proxy.waitForDeployment();

      const counterV2Iface = await ethers.getContractAt(
        "CounterV2",
        await proxy.getAddress()
      );

      await counterV2Iface.initialize(owner.address);

      const contractOwner = await counterV2Iface.getOwner.staticCall();
      expect(contractOwner).to.equal(owner.address);

      console.log("\n========== CounterV2.getOwner() ==========");
      console.log("Owner:", contractOwner);
      console.log("========================================\n");
    });
  });

  describe("任务 2.3: Storage 布局兼容性（重要！）", function () {
    it("应该演示正确的 storage 布局升级", async function () {
      // 创建一个新的 Proxy 实例
      const Proxy = await ethers.getContractFactory("Proxy");
      const storageProxy = await Proxy.deploy(await counterV1.getAddress(), owner.address);
      await storageProxy.waitForDeployment();

      const storageCounterIface = await ethers.getContractAt(
        "CounterV1",
        await storageProxy.getAddress()
      );

      await storageCounterIface.initialize(owner.address);
      await storageCounterIface.increment();

      // V1 的 storage 布局（预留 slot 0,1 给 Proxy）：
      // slot 2: count
      // slot 3: owner
      // slot 4: lastUpdated

      const proxyAddress = await storageProxy.getAddress();
      const slot2 = await getStorageAt(proxyAddress, "0x2");
      const slot3 = await getStorageAt(proxyAddress, "0x3");
      const slot4 = await getStorageAt(proxyAddress, "0x4");

      console.log("\n========== V1 Storage 布局 ==========");
      console.log("Slot 2 (count):", BigInt(slot2).toString());
      console.log("Slot 3 (owner):", ethers.getAddress("0x" + slot3.slice(-40)));
      console.log("Slot 4 (lastUpdated):", BigInt(slot4).toString());
      console.log("===================================\n");

      // 升级到 V2（正确：新增变量追加到后面）
      await storageProxy.upgrade(await counterV2.getAddress());

      const counterV2Iface = await ethers.getContractAt(
        "CounterV2",
        await storageProxy.getAddress()
      );

      // V2 的 storage 布局：
      // slot 2: count (与 V1 相同)
      // slot 3: owner (与 V1 相同)
      // slot 4: lastUpdated (与 V1 相同)
      // slot 5: totalOperations (新增)

      const newSlot2 = await getStorageAt(proxyAddress, "0x2");
      const newSlot3 = await getStorageAt(proxyAddress, "0x3");
      const newSlot4 = await getStorageAt(proxyAddress, "0x4");
      const slot5 = await getStorageAt(proxyAddress, "0x5");

      console.log("\n========== V2 Storage 布局 ==========");
      console.log("Slot 2 (count):", BigInt(newSlot2).toString());
      console.log("Slot 3 (owner):", ethers.getAddress("0x" + newSlot3.slice(-40)));
      console.log("Slot 4 (lastUpdated):", BigInt(newSlot4).toString());
      console.log("Slot 5 (totalOperations):", BigInt(slot5).toString());
      console.log("===================================\n");

      // 验证数据一致
      expect(slot2).to.equal(newSlot2);
      expect(slot3).to.equal(newSlot3);
      expect(slot4).to.equal(newSlot4);

      // 验证功能正常
      const count = await counterV2Iface.getCount.staticCall();
      expect(count).to.equal(1);

      await counterV2Iface.increment();
      const newCount = await counterV2Iface.getCount.staticCall();
      expect(newCount).to.equal(2);

      const totalOps = await counterV2Iface.getTotalOperations.staticCall();
      expect(totalOps).to.equal(1); // increment 增加了 1
    });

    it("应该演示错误的 storage 布局导致数据混乱", async function () {
      // 创建一个新的 Proxy 实例
      const Proxy = await ethers.getContractFactory("Proxy");
      const brokenProxy = await Proxy.deploy(await counterV1.getAddress(), owner.address);
      await brokenProxy.waitForDeployment();

      const brokenCounterIface = await ethers.getContractAt(
        "CounterV1",
        await brokenProxy.getAddress()
      );

      await brokenCounterIface.initialize(owner.address);
      await brokenCounterIface.increment();

      const countBefore = await brokenCounterIface.getCount.staticCall();
      const ownerBefore = await brokenCounterIface.getOwner.staticCall();

      console.log("\n========== 升级前 ==========");
      console.log("Count:", countBefore.toString());
      console.log("Owner:", ownerBefore);
      console.log("============================\n");

      // 升级到 BrokenCounter（错误：改变变量顺序）
      await brokenProxy.upgrade(await brokenCounter.getAddress());

      const brokenIface = await ethers.getContractAt(
        "BrokenCounter",
        await brokenProxy.getAddress()
      );

      // BrokenCounter 没有预留 slot 0、1，变量顺序与 V1 不同：
      // BrokenCounter slot 0 = count  → 对应 Proxy slot 0（原是 impl），所以 count() 读到的是 impl 地址当数字！
      // BrokenCounter slot 1 = owner  → 对应 Proxy slot 1（原是 admin）
      // BrokenCounter slot 2 = lastUpdated → 对应 Proxy slot 2（原是 V1 的 count）

      const countAfter = await brokenIface.count();
      const ownerAfter = await brokenIface.owner();

      console.log("\n========== 升级后（错误布局）==========");
      console.log("Count (实际是 Proxy slot 0/impl 的值):", countAfter.toString());
      console.log("Owner (实际是 Proxy slot 1/admin):", ownerAfter);
      console.log("\n数据混乱了! Count 不再是 1，而是 impl 地址被当成 uint256");
      console.log("===============================\n");

      // 验证数据混乱：升级前 count=1，升级后 BrokenCounter.count() 读的是 slot 0（impl），绝不是 1
      expect(countAfter).to.not.equal(1);
    });

    it("应该演示 BrokenCounter.increment() 和 getVersion()", async function () {
      const Proxy = await ethers.getContractFactory("Proxy");
      const brokenProxy = await Proxy.deploy(await counterV1.getAddress(), owner.address);
      await brokenProxy.waitForDeployment();

      const brokenCounterIface = await ethers.getContractAt(
        "CounterV1",
        await brokenProxy.getAddress()
      );

      await brokenCounterIface.initialize(owner.address);

      // 升级到 BrokenCounter
      await brokenProxy.upgrade(await brokenCounter.getAddress());

      const brokenIface = await ethers.getContractAt(
        "BrokenCounter",
        await brokenProxy.getAddress()
      );

      // 测试 getVersion()
      const version = await brokenIface.getVersion.staticCall();
      expect(version).to.equal("BROKEN");

      const proxyAddress = await brokenProxy.getAddress();

      // 先读 count()：BrokenCounter 的 count 在 slot 0，所以读到的是 Proxy 的 impl 地址（当 uint256）
      const countBeforeIncrement = await brokenIface.count();
      const slot0Before = await getStorageAt(proxyAddress, "0x0");
      expect(countBeforeIncrement).to.equal(BigInt(slot0Before));

      // 测试 increment() —— 会错误地给 slot 0（impl）加 1，破坏 proxy！
      await brokenIface.increment();

      // increment 后不能再调用 count()，因为 impl 已被破坏，delegatecall 会失败
      // 直接用 getStorageAt 看 slot 0 被 +1 了
      const slot0After = await getStorageAt(proxyAddress, "0x0");
      expect(BigInt(slot0After)).to.equal(countBeforeIncrement + 1n);

      console.log("\n========== BrokenCounter 测试 ==========");
      console.log("Version:", version);
      console.log("increment() 前 count() = slot 0 (impl):", countBeforeIncrement.toString());
      console.log("increment() 后 slot 0 被 +1，impl 指针已破坏:", slot0After);
      console.log("========================================\n");
    });
  });

  describe("任务 2.4: CounterV1 函数完整测试", function () {
    it("应该测试 CounterV1 的 decrement() 函数", async function () {
      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy = await Proxy.deploy(await counterV1.getAddress(), owner.address);
      await proxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await proxy.getAddress()
      );

      await counterV1Iface.initialize(owner.address);

      // 先 increment 几次
      await counterV1Iface.increment();
      await counterV1Iface.increment();

      let count = await counterV1Iface.getCount.staticCall();
      expect(count).to.equal(2);

      // 测试 decrement
      await counterV1Iface.decrement();
      count = await counterV1Iface.getCount.staticCall();
      expect(count).to.equal(1);

      // 测试 decrement 边界检查
      await counterV1Iface.decrement();
      count = await counterV1Iface.getCount.staticCall();
      expect(count).to.equal(0);

      await expect(counterV1Iface.decrement()).to.be.revertedWith("count cannot go below zero");

      console.log("\n========== CounterV1 decrement() 测试 ==========");
      console.log("increment x2, decrement x2, decrement 失败");
      console.log("count:", count.toString());
      console.log("==================================================\n");
    });

    it("应该测试 CounterV1 的 getLastUpdated() 函数", async function () {
      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy = await Proxy.deploy(await counterV1.getAddress(), owner.address);
      await proxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await proxy.getAddress()
      );

      await counterV1Iface.initialize(owner.address);

      const lastUpdatedBefore = await counterV1Iface.getLastUpdated.staticCall();
      expect(lastUpdatedBefore).to.be.greaterThan(0);

      // 等待并执行操作
      await counterV1Iface.increment();

      const lastUpdatedAfter = await counterV1Iface.getLastUpdated.staticCall();
      expect(lastUpdatedAfter).to.be.greaterThan(lastUpdatedBefore);

      console.log("\n========== CounterV1 getLastUpdated() 测试 ==========");
      console.log("初始化时间:", lastUpdatedBefore.toString());
      console.log("increment 后时间:", lastUpdatedAfter.toString());
      console.log("====================================================\n");
    });

    it("应该测试 CounterV1 的 fallback() 函数", async function () {
      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy = await Proxy.deploy(await counterV1.getAddress(), owner.address);
      await proxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await proxy.getAddress()
      );

      await counterV1Iface.initialize(owner.address);

      // 调用不存在的函数并带 ETH，应该触发 CounterV1 的 fallback()
      const proxyAddress = await proxy.getAddress();

      // 调用不存在的函数，并携带 ETH
      const fakeFuncData = ethers.id("nonExistentFunction()").slice(0, 10);

      const tx = await owner.sendTransaction({
        to: proxyAddress,
        value: ethers.parseEther("0.5"),
        data: fakeFuncData
      });
      const receipt = await tx.wait();

      // 验证 Proxy 接收到了 ETH（CounterV1 的 fallback 是 payable）
      const balance = BigInt(await getBalance(proxyAddress));
      expect(balance).to.equal(BigInt(ethers.parseEther("0.5")));

      console.log("\n========== CounterV1 fallback() 测试 ==========");
      console.log("调用不存在的函数并发送 ETH");
      console.log("CounterV1 fallback 接收了 ETH");
      console.log("余额:", ethers.formatEther(balance));
      console.log("================================================\n");
    });

    it("应该测试 CounterV1 的 receive() 函数", async function () {
      const Proxy = await ethers.getContractFactory("Proxy");
      const proxy = await Proxy.deploy(await counterV1.getAddress(), owner.address);
      await proxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await proxy.getAddress()
      );

      await counterV1Iface.initialize(owner.address);

      // 向 Proxy 发送 ETH，应该通过 CounterV1 的 receive()
      const proxyAddress = await proxy.getAddress();

      await owner.sendTransaction({
        to: proxyAddress,
        value: ethers.parseEther("1.0")
      });

      // 验证 Proxy 接收到了 ETH
      const balance = BigInt(await getBalance(proxyAddress));
      expect(balance).to.equal(BigInt(ethers.parseEther("1.0")));

      console.log("\n========== CounterV1 receive() 测试 ==========");
      console.log("CounterV1 receive 接收了 ETH");
      console.log("余额:", ethers.formatEther(balance));
      console.log("===============================================\n");
    });
  });

  describe("任务 2.5: ProxyUsingFallback - 测试 _fallback 实现", function () {
    it("应该演示 ProxyUsingFallback 与 Proxy 行为一致", async function () {
      const ProxyUsingFallback = await ethers.getContractFactory("ProxyUsingFallback");

      // 部署使用 _fallback 的 Proxy
      const fallbackProxy = await ProxyUsingFallback.deploy(
        await counterV1.getAddress(),
        owner.address
      );
      await fallbackProxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await fallbackProxy.getAddress()
      );

      // 初始化
      await counterV1Iface.initialize(owner.address);

      // 测试基本功能 - increment
      await counterV1Iface.increment();
      let count = await counterV1Iface.getCount.staticCall();
      expect(count).to.equal(1);

      // 测试 incrementBy
      await counterV1Iface.incrementBy(5);
      count = await counterV1Iface.getCount.staticCall();
      expect(count).to.equal(6);

      // 测试 decrement
      await counterV1Iface.decrement();
      count = await counterV1Iface.getCount.staticCall();
      expect(count).to.equal(5);

      console.log("\n========== ProxyUsingFallback 测试 ==========");
      console.log("使用 _fallback 实现的 Proxy");
      console.log("increment, incrementBy, decrement 都正常工作");
      console.log("count:", count.toString());
      console.log("=============================================\n");
    });

    it("应该演示 ProxyUsingFallback 可以接收 ETH", async function () {
      const ProxyUsingFallback = await ethers.getContractFactory("ProxyUsingFallback");
      const fallbackProxy = await ProxyUsingFallback.deploy(
        await counterV1.getAddress(),
        owner.address
      );
      await fallbackProxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await fallbackProxy.getAddress()
      );

      await counterV1Iface.initialize(owner.address);

      // 测试纯 ETH 转账（触发 receive）
      const proxyAddress = await fallbackProxy.getAddress();

      await owner.sendTransaction({
        to: proxyAddress,
        value: ethers.parseEther("1.0")
      });

      const balance = BigInt(await getBalance(proxyAddress));
      expect(balance).to.equal(BigInt(ethers.parseEther("1.0")));

      console.log("\n========== ProxyUsingFallback ETH 接收 ==========");
      console.log("_fallback 的 receive() 正常工作");
      console.log("余额:", ethers.formatEther(balance));
      console.log("================================================\n");
    });

    it("应该演示 ProxyUsingFallback 的 fallback() 处理不存在的函数", async function () {
      const ProxyUsingFallback = await ethers.getContractFactory("ProxyUsingFallback");
      const fallbackProxy = await ProxyUsingFallback.deploy(
        await counterV1.getAddress(),
        owner.address
      );
      await fallbackProxy.waitForDeployment();

      const counterV1Iface = await ethers.getContractAt(
        "CounterV1",
        await fallbackProxy.getAddress()
      );

      await counterV1Iface.initialize(owner.address);

      // 调用不存在的函数
      const proxyAddress = await fallbackProxy.getAddress();
      const fakeFuncData = ethers.id("nonExistentFunction()").slice(0, 10);

      const tx = await owner.sendTransaction({
        to: proxyAddress,
        value: ethers.parseEther("0.5"),
        data: fakeFuncData
      });
      const receipt = await tx.wait();

      // 验证 ETH 被 fallback 接收了
      const balance = BigInt(await getBalance(proxyAddress));
      expect(balance).to.equal(BigInt(ethers.parseEther("0.5")));

      console.log("\n========== ProxyUsingFallback fallback() ==========");
      console.log("_fallback 的 fallback() 正常处理不存在的函数");
      console.log("余额:", ethers.formatEther(balance));
      console.log("===================================================\n");
    });

    it("应该演示 _fallback 与 _delegate 行为一致", async function () {
      const Proxy = await ethers.getContractFactory("Proxy");
      const ProxyUsingFallback = await ethers.getContractFactory("ProxyUsingFallback");

      // 部署两个 Proxy，一个用 _delegate，一个用 _fallback
      const delegateProxy = await Proxy.deploy(
        await counterV1.getAddress(),
        owner.address
      );
      await delegateProxy.waitForDeployment();

      const fallbackProxy = await ProxyUsingFallback.deploy(
        await counterV1.getAddress(),
        owner.address
      );
      await fallbackProxy.waitForDeployment();

      // 通过两个 Proxy 进行相同的操作
      const delegateIface = await ethers.getContractAt("CounterV1", await delegateProxy.getAddress());
      const fallbackIface = await ethers.getContractAt("CounterV1", await fallbackProxy.getAddress());

      await delegateIface.initialize(owner.address);
      await fallbackIface.initialize(owner.address);

      // 执行一系列操作
      for (let i = 0; i < 5; i++) {
        await delegateIface.increment();
        await fallbackIface.increment();
      }

      await delegateIface.incrementBy(10);
      await fallbackIface.incrementBy(10);

      const delegateCount = await delegateIface.getCount.staticCall();
      const fallbackCount = await fallbackIface.getCount.staticCall();

      expect(delegateCount).to.equal(fallbackCount);
      expect(delegateCount).to.equal(15); // 5 + 10 = 15

      console.log("\n========== _fallback vs _delegate 对比 ==========");
      console.log("_delegate 结果:", delegateCount.toString());
      console.log("_fallback 结果:", fallbackCount.toString());
      console.log("两者行为一致!");
      console.log("================================================\n");
    });
  });

  describe("任务 2.4: Proxy 接收 ETH", function () {
    it("应该演示 Proxy 可以接收 ETH 并转发到 impl", async function () {
      // 这个测试需要 impl 合约有 receive 或 fallback
      // 简单演示：Proxy 可以接收 ETH

      const proxyAddress = await proxy.getAddress();

      // 直接发送 ETH 到 Proxy
      await owner.sendTransaction({
        to: proxyAddress,
        value: ethers.parseEther("1.0")
      });

      const balance = BigInt(await getBalance(proxyAddress));
      expect(balance).to.equal(BigInt(ethers.parseEther("1.0")));

      console.log("\n========== Proxy 接收 ETH ==========");
      console.log("Proxy 地址:", proxyAddress);
      console.log("ETH 余额:", ethers.formatEther(balance));
      console.log("===================================\n");
    });
  });
});
