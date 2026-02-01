/**
 * 简化的Solidity合约交互演示
 * 重点展示编译、部署和前端交互的核心概念
 */

const { ethers } = require("ethers");

// 读取编译后的合约ABI
const PackingChallengeABI = require("../../../artifacts/contracts/examples/01-slot-packing/PackingChallenge.sol/PackingChallenge.json").abi;
const PackingChallengeOptimizedABI = require("../../../artifacts/contracts/examples/01-slot-packing/PackingChallengeOptimized.sol/PackingChallengeOptimized.json").abi;

// 读取bytecode
const PackingChallengeBytecode = require("../../../artifacts/contracts/examples/01-slot-packing/PackingChallenge.sol/PackingChallenge.json").bytecode;
const PackingChallengeOptimizedBytecode = require("../../../artifacts/contracts/examples/01-slot-packing/PackingChallengeOptimized.sol/PackingChallengeOptimized.json").bytecode;

class SimplePackingDemo {
  constructor() {
    this.provider = null;
    this.signer = null;
  }

  /**
   * 第一步：连接到区块链网络
   */
  async connectToNetwork() {
    console.log("🌐 第一步：连接到Hardhat网络");

    // 连接到本地Hardhat节点
    this.provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // 创建钱包（使用Hardhat的测试账户）
    const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    this.signer = new ethers.Wallet(privateKey, this.provider);

    console.log("✅ 网络连接成功");
    console.log("📍 账户地址:", this.signer.address);

    const balance = await this.provider.getBalance(this.signer.address);
    console.log("💰 账户余额:", ethers.formatEther(balance), "ETH");
  }

  /**
   * 第二步：部署合约
   */
  async deployContract(abi, bytecode, contractName) {
    console.log(`\n🚀 第二步：部署${contractName}合约`);

    // 创建合约工厂
    const factory = new ethers.ContractFactory(abi, bytecode, this.signer);

    // 部署合约
    console.log("📝 正在发送部署交易...");
    const contract = await factory.deploy();

    // 等待部署确认
    console.log("⏳ 等待交易确认...");
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`✅ ${contractName}部署成功`);
    console.log("📍 合约地址:", address);

    return contract;
  }

  /**
   * 第三步：读取合约数据
   */
  async readContractData(contract, contractName) {
    console.log(`\n📖 第三步：读取${contractName}合约数据`);

    try {
      // 调用合约的view函数（不需要Gas）
      const [a, b, c] = await Promise.all([
        contract.a(),
        contract.b(),
        contract.c()
      ]);

      console.log("🔢 状态变量值:");
      console.log("  uint128 a =", a.toString());
      console.log("  uint256 b =", b.toString());
      console.log("  uint128 c =", c.toString());

      return { a: a.toString(), b: b.toString(), c: c.toString() };
    } catch (error) {
      console.error("❌ 读取数据失败:", error.message);
      return null;
    }
  }

  /**
   * 第四步：分析存储槽使用
   */
  async analyzeStorageSlots(contract, contractName) {
    console.log(`\n💾 第四步：分析${contractName}的存储槽使用`);

    const address = await contract.getAddress();
    let usedSlots = 0;

    console.log("🔍 检查前5个存储槽:");
    for (let i = 0; i < 5; i++) {
      // 直接读取EVM存储，绕过ABI
      const slotValue = await this.provider.getStorage(address, i);
      const bigIntValue = BigInt(slotValue);

      if (bigIntValue !== 0n) {
        usedSlots++;
        console.log(`  Slot ${i}: ${slotValue} ✅`);
      } else {
        console.log(`  Slot ${i}: 0x${"0".repeat(64)} ⭕`);
      }
    }

    console.log(`📊 ${contractName}使用了 ${usedSlots} 个存储槽`);
    console.log(`💵 部署Gas成本约: ${usedSlots * 20000} (每个slot 20,000 Gas)`);

    return usedSlots;
  }

  /**
   * 完整演示流程
   */
  async run() {
    try {
      // 第一步：连接网络
      await this.connectToNetwork();

      console.log("\n" + "=".repeat(50));
      console.log("开始演示：合约编译部署与存储优化");
      console.log("=".repeat(50));

      // 第二步：部署非优化版本
      const contract1 = await this.deployContract(
        PackingChallengeABI,
        PackingChallengeBytecode,
        "非优化版本"
      );

      // 第三步：读取非优化版本数据
      await this.readContractData(contract1, "非优化版本");

      // 第四步：分析非优化版本存储
      const slots1 = await this.analyzeStorageSlots(contract1, "非优化版本");

      console.log("\n" + "-".repeat(50));

      // 第二步：部署优化版本（使用不同的账户避免nonce冲突）
      const privateKey2 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
      const signer2 = new ethers.Wallet(privateKey2, this.provider);

      const factory2 = new ethers.ContractFactory(
        PackingChallengeOptimizedABI,
        PackingChallengeOptimizedBytecode,
        signer2
      );

      console.log("\n🚀 部署优化版本合约");
      const contract2 = await factory2.deploy();
      await contract2.waitForDeployment();

      console.log("✅ 优化版本部署成功");

      // 第三步：读取优化版本数据
      await this.readContractData(contract2, "优化版本");

      // 第四步：分析优化版本存储
      const slots2 = await this.analyzeStorageSlots(contract2, "优化版本");

      // 最终对比分析
      console.log("\n" + "=".repeat(50));
      console.log("🎯 最终对比分析");
      console.log("=".repeat(50));

      console.log("📈 存储效率对比:");
      console.log(`  非优化版本: ${slots1} 个slot`);
      console.log(`  优化版本:   ${slots2} 个slot`);
      console.log(`  节省:       ${slots1 - slots2} 个slot`);
      console.log(`  节省Gas:   ${(slots1 - slots2) * 20000} (约${((slots1 - slots2) / slots1 * 100).toFixed(1)}%)`);

      console.log("\n💡 原理分析:");
      console.log("  非优化顺序: uint128 a, uint256 b, uint128 c");
      console.log("    → Slot 0: [a (16字节)][空隙 (16字节)]");
      console.log("    → Slot 1: [b (32字节)]");
      console.log("    → Slot 2: [c (16字节)][空隙 (16字节)]");

      console.log("  优化顺序:   uint128 a, uint128 c, uint256 b");
      console.log("    → Slot 0: [a (16字节)][c (16字节)] ✨ 完美打包！");
      console.log("    → Slot 1: [b (32字节)]");

      console.log("\n✨ 演示完成！");

    } catch (error) {
      console.error("❌ 演示过程中出错:", error.message);
    }
  }
}

// 运行演示
const demo = new SimplePackingDemo();
demo.run().catch(console.error);