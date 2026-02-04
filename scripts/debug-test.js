/**
 * Hardhat 调试示例脚本
 *
 * 使用方法：
 * 1. 在代码中添加 debugger 语句
 * 2. 运行: npx hardhat run scripts/debug-test.js
 */

const hre = require("hardhat");

async function main() {
  console.log("=== 开始调试会话 ===\n");

  // 部署合约
  const Counter = await hre.ethers.getContractFactory("CounterV1");
  const counter = await Counter.deploy();
  await counter.waitForDeployment();

  console.log("Counter deployed to:", await counter.getAddress());

  // 在这里添加断点调试
  debugger;  // Cursor 会在这一行暂停（需要 Node.js 调试配置）

  // 调用函数
  const tx = await counter.increment();
  const receipt = await tx.wait();

  console.log("Transaction hash:", receipt.hash);

  // 可以在这里查看变量
  const count = await counter.getCount();
  console.log("Current count:", count.toString());

  debugger;  // 第二个断点
}

// Hardhat 调试模式
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
