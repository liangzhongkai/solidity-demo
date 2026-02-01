/**
 * 部署过程可视化演示
 * 详细展示每一步发生了什么
 */

const { ethers } = require("ethers");

// 读取合约数据
const PackingChallengeABI = require("../../../artifacts/contracts/examples/01-slot-packing/PackingChallenge.sol/PackingChallenge.json").abi;
const PackingChallengeBytecode = require("../../../artifacts/contracts/examples/01-slot-packing/PackingChallenge.sol/PackingChallenge.json").bytecode;

class DeploymentVisualizer {
  constructor() {
    this.provider = null;
    this.signer = null;
  }

  async visualizeDeployment() {
    console.log("🚀 Solidity合约部署过程完整演示\n");

    // 第一步：准备工作
    console.log("📋 第一步：部署前的准备");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    this.provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    this.signer = new ethers.Wallet(privateKey, this.provider);

    console.log("🔗 连接到网络: Hardhat Network (http://127.0.0.1:8545)");
    console.log("👤 部署账户: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    console.log("💰 账户余额: 10000 ETH (测试货币)");

    // 检查网络状态
    const network = await this.provider.getNetwork();
    console.log("🌐 网络信息:");
    console.log(`   链ID: ${network.chainId}`);
    console.log(`   当前区块: ${await this.provider.getBlockNumber()}`);

    // 第二步：分析合约数据
    console.log("\n📦 第二步：分析合约数据");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("📄 合约信息:");
    console.log(`   ABI长度: ${PackingChallengeABI.length} 个函数定义`);
    console.log(`   Bytecode长度: ${PackingChallengeBytecode.length} 字符`);
    console.log(`   实际大小: ${PackingChallengeBytecode.length / 2 - 1} 字节`);

    // 分析bytecode结构
    console.log("\n🔍 Bytecode结构分析:");
    console.log("   0x6080604052... (部署代码)");
    console.log("   ├─ 构造函数逻辑");
    console.log("   ├─ 变量初始化代码");
    console.log("   └─ 运行时合约代码");

    // 第三步：创建部署交易
    console.log("\n✍️  第三步：创建部署交易");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const factory = new ethers.ContractFactory(
      PackingChallengeABI,
      PackingChallengeBytecode,
      this.signer
    );

    console.log("📝 部署交易结构:");
    console.log("   {");
    console.log("     to: null,                    // 部署交易，无接收者");
    console.log("     from: 0xf39Fd6e51...,        // 部署者地址");
    console.log("     data: 0x6080604052...,       // 合约字节码");
    console.log("     gasLimit: 约500000,          // Gas限制");
    console.log("     value: 0 ETH                 // 发送的以太币");
    console.log("   }");

    // 获取部署前的nonce
    const nonceBefore = await this.provider.getTransactionCount(this.signer.address);
    console.log(`\n🔢 当前nonce (交易序号): ${nonceBefore}`);

    // 第四步：发送部署交易
    console.log("\n🚀 第四步：发送部署交易");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("⏳ 正在部署合约...");

    // 记录部署前的区块号
    const blockBefore = await this.provider.getBlockNumber();

    const contract = await factory.deploy();

    console.log("✅ 交易已发送到网络");
    console.log("📨 交易哈希:", contract.deploymentTransaction()?.hash || "pending");

    // 第五步：等待确认
    console.log("\n⏳ 第五步：等待交易确认");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("🔄 等待矿工打包交易...");
    await contract.waitForDeployment();

    // 获取部署后的信息
    const blockAfter = await this.provider.getBlockNumber();
    const nonceAfter = await this.provider.getTransactionCount(this.signer.address);

    console.log("✅ 交易已确认！");
    console.log(`📦 区块: ${blockBefore} → ${blockAfter} (新增1个区块)`);
    console.log(`🔢 Nonce: ${nonceBefore} → ${nonceAfter} (已使用1个)`);

    // 第六步：分析部署结果
    console.log("\n🎯 第六步：部署结果分析");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const contractAddress = await contract.getAddress();
    console.log("📍 合约地址:", contractAddress);

    // 获取交易收据
    const receipt = await this.provider.getTransactionReceipt(contract.deploymentTransaction()?.hash || "");
    if (receipt) {
      console.log("📊 部署统计:");
      console.log(`   实际Gas使用: ${receipt.gasUsed}`);
      console.log(`   Gas价格: ${receipt.gasPrice} wei`);
      console.log(`   交易费用: ${ethers.formatEther(receipt.gasUsed * receipt.gasPrice)} ETH`);
      console.log(`   状态: ${receipt.status === 1 ? "✅ 成功" : "❌ 失败"}`);
    }

    // 第七步：验证合约数据
    console.log("\n✅ 第七步：验证合约存储");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("🔍 检查合约存储槽:");
    for (let i = 0; i < 3; i++) {
      const slotValue = await this.provider.getStorage(contractAddress, i);
      const bigIntValue = BigInt(slotValue);

      if (bigIntValue !== 0n) {
        console.log(`   Slot ${i}: ${slotValue} ✅`);
        console.log(`      = ${bigIntValue} (十进制)`);
      } else {
        console.log(`   Slot ${i}: 0x${"0".repeat(64)} ⭕`);
      }
    }

    // 第八步：地址生成原理
    console.log("\n🔬 第八步：合约地址生成原理");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("📐 地址生成公式:");
    console.log("   合约地址 = Keccak256(部署者地址 + nonce)[12:]");
    console.log("");
    console.log("🧮 计算过程:");
    console.log(`   部署者地址: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`);
    console.log(`   Nonce: ${nonceBefore}`);
    console.log(`   拼接结果: 0xf39Fd6e51...${nonceBefore.toString(16).padStart(2, '0')}`);
    console.log(`   Keccak256哈希: 0x...`);
    console.log(`   取后20字节: ${contractAddress}`);
    console.log("");
    console.log("💡 这意味着:");
    console.log("   - 相同账户 + 相同nonce = 相同合约地址");
    console.log("   - 部署者可以预先计算出合约地址");

    // 第九步：网络状态变化
    console.log("\n🌐 第九步：网络状态变化");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const latestBlock = await this.provider.getBlock(blockAfter);
    console.log("📋 最新区块信息:");
    console.log(`   区块号: ${latestBlock?.number}`);
    console.log(`   时间戳: ${latestBlock?.timestamp}`);
    console.log(`   交易数: ${latestBlock?.transactions.length}`);
    console.log(`   Gas使用: ${latestBlock?.gasUsed}`);

    // 第十步：合约调用演示
    console.log("\n🎮 第十步：合约交互演示");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("📞 读取合约状态变量:");
    const [a, b, c] = await Promise.all([
      contract.a(),
      contract.b(),
      contract.c()
    ]);

    console.log(`   contract.a() → ${a}`);
    console.log(`   contract.b() → ${b}`);
    console.log(`   contract.c() → ${c}`);

    console.log("\n🔍 这背后的数据流:");
    console.log("   前端JS → ABI编码 → RPC调用 → 合约执行 → ABI解码 → 返回结果");

    // 总结
    console.log("\n📊 部署总结");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("✨ 部署成功！合约已永久存储在区块链上");
    console.log("");
    console.log("📍 合约信息卡:");
    console.log("┌────────────────────────────────────────┐");
    console.log("│  合约地址: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9 │");
    console.log("│  网络: Hardhat Network                 │");
    console.log("│  部署者: 0xf39Fd6e51aad88F6F4ce6aB8...  │");
    console.log("│  存储槽: 3个 (成本: ~60,000 Gas)       │");
    console.log("│  状态: ✅ 活跃                         │");
    console.log("└────────────────────────────────────────┘");

    console.log("\n🎓 关键理解:");
    console.log("   1. 合约部署 = 发送特殊的创建交易");
    console.log("   2. 部署位置 = Hardhat本地网络 (你的电脑内存)");
    console.log("   3. 合约地址 = 由部署者地址和nonce计算得出");
    console.log("   4. 数据存储 = 全球所有节点同步存储");
    console.log("   5. 交互方式 = 通过合约地址 + ABI进行RPC调用");

    console.log("\n🚀 现在你可以用这个地址与合约交互了！");
    console.log(`   const contract = new ethers.Contract("${contractAddress}", ABI, signer)`);
  }
}

// 运行可视化演示
const visualizer = new DeploymentVisualizer();
visualizer.visualizeDeployment().catch(console.error);