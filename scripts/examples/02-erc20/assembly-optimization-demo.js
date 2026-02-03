const hre = require("hardhat");

async function main() {
  console.log("🚀 Production ERC20 - Assembly 优化演示\n");

  // 获取签名者
  const [deployer, addr1, addr2] = await hre.ethers.getSigners();
  console.log("📝 部署账户:", deployer.address);
  console.log("👥 测试账户:");
  console.log("  Addr1:", addr1.address);
  console.log("  Addr2:", addr2.address);
  console.log();

  // 部署合约
  console.log("⏳ 部署 ProductionERC20 合约...");
  const ProductionERC20 = await hre.ethers.getContractFactory("ProductionERC20");
  const token = await ProductionERC20.deploy(
    "Assembly Optimized Token",
    "AOT",
    18,
    hre.ethers.parseEther("1000000"),
    deployer.address
  );

  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("✅ 合约部署成功!");
  console.log("📍 合约地址:", tokenAddress);
  console.log();

  // 初始余额
  const deployerBalance = await token.balanceOf(deployer.address);
  console.log("💰 初始余额分布:");
  console.log("  Deployer:", hre.ethers.formatEther(deployerBalance), "tokens");
  console.log();

  // 1. 基础功能测试
  console.log("🔧 1. Assembly 优化基础功能测试");
  console.log("─".repeat(50));

  const transferAmount = hre.ethers.parseEther("100");

  // 测试标准版本
  console.log("📤 标准版本转账 100 tokens → Addr1");
  const tx1 = await token.transfer(addr1.address, transferAmount);
  const receipt1 = await tx1.wait();
  console.log("✅ 转账成功 | Gas:", receipt1.gasUsed.toString());

  const addr1Balance = await token.balanceOf(addr1.address);
  console.log("📊 Addr1 余额:", hre.ethers.formatEther(addr1Balance), "tokens");

  // 测试优化版本
  console.log("📤 Assembly优化版本转账 100 tokens → Addr2");
  const tx2 = await token.transferOptimized(addr2.address, transferAmount);
  const receipt2 = await tx2.wait();
  console.log("✅ 转账成功 | Gas:", receipt2.gasUsed.toString());

  const addr2Balance = await token.balanceOf(addr2.address);
  console.log("📊 Addr2 余额:", hre.ethers.formatEther(addr2Balance), "tokens");
  console.log();

  // 2. Gas 消耗对比分析
  console.log("⛽ 2. Gas 消耗对比分析");
  console.log("─".repeat(50));

  const testAmounts = [
    hre.ethers.parseEther("10"),
    hre.ethers.parseEther("100"),
    hre.ethers.parseEther("1000"),
    hre.ethers.parseEther("10000"),
  ];

  console.log("📊 不同金额的 Gas 消耗对比:");
  console.log("┌────────────────┬──────────────┬──────────────┬──────────────┐");
  console.log("│ 转账金额        │ 标准版本     │ 优化版本     │ 节省比例     │");
  console.log("├────────────────┼──────────────┼──────────────┼──────────────┤");

  for (const amount of testAmounts) {
    // 标准版本测试
    const txStandard = await token.transfer(addr1.address, amount);
    const receiptStandard = await txStandard.wait();
    const standardGas = receiptStandard.gasUsed;

    // 优化版本测试
    const txOptimized = await token.transferOptimized(addr2.address, amount);
    const receiptOptimized = await txOptimized.wait();
    const optimizedGas = receiptOptimized.gasUsed;

    const gasSaved = standardGas - optimizedGas;
    const percentSaved = ((Number(gasSaved) * 100) / Number(standardGas)).toFixed(2);

    console.log(
      `│ ${hre.ethers.formatEther(amount).padEnd(14)} │ ` +
      `${standardGas.toString().padStart(12)} │ ` +
      `${optimizedGas.toString().padStart(12)} │ ` +
      `${percentSaved.padStart(10)}% │`
    );
  }

  console.log("└────────────────┴──────────────┴──────────────┴──────────────┘");
  console.log();

  // 3. 批量操作性能测试
  console.log("🏃 3. 批量操作性能测试");
  console.log("─".repeat(50));

  const batchCount = 10;
  const batchAmount = hre.ethers.parseEther("50");

  // 重置余额
  await token.connect(addr1).transfer(deployer.address, await token.balanceOf(addr1.address));
  await token.connect(addr2).transfer(deployer.address, await token.balanceOf(addr2.address));

  // 标准版本批量测试
  console.log(`📤 标准版本 - 执行 ${batchCount} 次转账...`);
  let standardTotalGas = 0n;
  const startTime1 = Date.now();

  for (let i = 0; i < batchCount; i++) {
    const tx = await token.transfer(addr1.address, batchAmount);
    const receipt = await tx.wait();
    standardTotalGas += receipt.gasUsed;
  }

  const endTime1 = Date.now();
  const standardTime = endTime1 - startTime1;

  console.log(`✅ 完成! 总 Gas: ${standardTotalGas.toString()}, 耗时: ${standardTime}ms`);
  console.log(`   平均 Gas: ${(standardTotalGas / BigInt(batchCount)).toString()}`);
  console.log();

  // 优化版本批量测试
  console.log(`📤 Assembly优化版本 - 执行 ${batchCount} 次转账...`);
  let optimizedTotalGas = 0n;
  const startTime2 = Date.now();

  for (let i = 0; i < batchCount; i++) {
    const tx = await token.transferOptimized(addr2.address, batchAmount);
    const receipt = await tx.wait();
    optimizedTotalGas += receipt.gasUsed;
  }

  const endTime2 = Date.now();
  const optimizedTime = endTime2 - startTime2;

  console.log(`✅ 完成! 总 Gas: ${optimizedTotalGas.toString()}, 耗时: ${optimizedTime}ms`);
  console.log(`   平均 Gas: ${(optimizedTotalGas / BigInt(batchCount)).toString()}`);
  console.log();

  // 批量操作总结
  const totalGasSaved = standardTotalGas - optimizedTotalGas;
  const avgGasSaved = totalGasSaved / BigInt(batchCount);
  const percentSaved = ((Number(totalGasSaved) * 100) / Number(standardTotalGas)).toFixed(2);

  console.log("📊 批量操作总结:");
  console.log("  总节省 Gas:", totalGasSaved.toString());
  console.log("  平均节省 Gas:", avgGasSaved.toString());
  console.log("  优化比例:", `${percentSaved}%`);
  console.log("  时间对比:", `标准 ${standardTime}ms vs 优化 ${optimizedTime}ms`);
  console.log();

  // 4. 极端情况测试
  console.log("🎯 4. 极端情况测试");
  console.log("─".repeat(50));

  // 最小额转账
  console.log("📤 最小金额转账 (1 wei) - Assembly版本");
  const minTx = await token.transferOptimized(addr1.address, 1);
  const minReceipt = await minTx.wait();
  console.log("✅ 成功 | Gas:", minReceipt.gasUsed.toString());

  // 最大额转账
  console.log("📤 最大金额转账 (全部余额) - Assembly版本");
  const deployerCurrentBalance = await token.balanceOf(deployer.address);
  const maxTx = await token.transferOptimized(addr2.address, deployerCurrentBalance);
  const maxReceipt = await maxTx.wait();
  console.log("✅ 成功 | Gas:", maxReceipt.gasUsed.toString());

  // 零额转账
  console.log("📤 零金额转账 (0 wei) - Assembly版本");
  const zeroTx = await token.transferOptimized(addr1.address, 0);
  const zeroReceipt = await zeroTx.wait();
  console.log("✅ 成功 | Gas:", zeroReceipt.gasUsed.toString());
  console.log();

  // 5. transferFromOptimized 测试
  console.log("🔗 5. transferFromOptimized - Assembly 优化授权转账测试");
  console.log("─".repeat(50));

  // 先从 addr2 转回一些余额给 deployer（因为前面的"最大金额转账"可能清空了 deployer）
  const currentAddr2Balance = await token.balanceOf(addr2.address);
  if (currentAddr2Balance > hre.ethers.parseEther("10000")) {
    await token.connect(addr2).transfer(deployer.address, currentAddr2Balance - hre.ethers.parseEther("100"));
  }

  // 给 addr1 转账用于测试
  const testFunding = hre.ethers.parseEther("10000");
  console.log("📤 给 Addr1 转账 10000 tokens 用于测试...");
  await token.transfer(addr1.address, testFunding);
  console.log("✅ 转账完成");
  console.log();

  // 授权测试
  const approveAmount = hre.ethers.parseEther("5000");
  console.log("🔐 Addr1 授权 Deployer 5000 tokens...");
  const approveTx = await token.connect(addr1).approve(deployer.address, approveAmount);
  const approveReceipt = await approveTx.wait();
  console.log("✅ 授权成功 | Gas:", approveReceipt.gasUsed.toString());

  const allowance = await token.allowance(addr1.address, deployer.address);
  console.log("📊 当前授权额度:", hre.ethers.formatEther(allowance), "tokens");
  console.log();

  // transferFrom 优化版本测试
  const transferFromAmount = hre.ethers.parseEther("1000");
  console.log("📤 使用 Assembly 优化版本从 Addr1 转账到 Addr2...");

  // 先测试标准版本
  const txStandardFrom = await token.transferFrom(addr1.address, addr2.address, transferFromAmount);
  const receiptStandardFrom = await txStandardFrom.wait();
  console.log("✅ 标准版本成功 | Gas:", receiptStandardFrom.gasUsed.toString());

  // 重新授权
  await token.connect(addr1).approve(deployer.address, approveAmount);

  // 测试优化版本
  const txOptimizedFrom = await token.transferFromOptimized(addr1.address, addr2.address, transferFromAmount);
  const receiptOptimizedFrom = await txOptimizedFrom.wait();
  console.log("✅ Assembly优化版本成功 | Gas:", receiptOptimizedFrom.gasUsed.toString());

  const gasSavedFrom = receiptStandardFrom.gasUsed - receiptOptimizedFrom.gasUsed;
  const percentSavedFrom = ((Number(gasSavedFrom) * 100) / Number(receiptStandardFrom.gasUsed)).toFixed(2);
  console.log(`⛽ 节省 Gas: ${gasSavedFrom.toString()} (${percentSavedFrom}%)`);

  // 验证余额和授权
  const addr1FinalBalance = await token.balanceOf(addr1.address);
  const addr2FinalBalance = await token.balanceOf(addr2.address);
  const remainingAllowance = await token.allowance(addr1.address, deployer.address);

  console.log();
  console.log("📊 授权转账后状态:");
  console.log("  Addr1 余额:", hre.ethers.formatEther(addr1FinalBalance), "tokens");
  console.log("  Addr2 余额:", hre.ethers.formatEther(addr2FinalBalance), "tokens");
  console.log("  剩余授权:", hre.ethers.formatEther(remainingAllowance), "tokens");
  console.log();

  // 6. 功能正确性验证
  console.log("✅ 6. 功能正确性验证");
  console.log("─".repeat(50));

  // 重新获取余额
  const finalDeployerBalance = await token.balanceOf(deployer.address);
  const finalAddr1Balance = await token.balanceOf(addr1.address);
  const finalAddr2Balance = await token.balanceOf(addr2.address);
  const finalTotalSupply = await token.totalSupply();

  console.log("💰 最终余额分布:");
  console.log("  Deployer:", hre.ethers.formatEther(finalDeployerBalance), "tokens");
  console.log("  Addr1:", hre.ethers.formatEther(finalAddr1Balance), "tokens");
  console.log("  Addr2:", hre.ethers.formatEther(finalAddr2Balance), "tokens");
  console.log("  总供应量:", hre.ethers.formatEther(finalTotalSupply), "tokens");

  // 验证总供应量不变
  const calculatedTotal = finalDeployerBalance + finalAddr1Balance + finalAddr2Balance;
  console.log();
  console.log("🔍 验证结果:");
  console.log("  总供应量一致:", finalTotalSupply.toString() === calculatedTotal.toString() ? "✅" : "❌");
  console.log("  无代币丢失:", finalTotalSupply.toString() === hre.ethers.parseEther("1000000").toString() ? "✅" : "❌");
  console.log();

  // 7. Assembly 优化总结
  console.log("🏆 Assembly 优化总结");
  console.log("─".repeat(50));
  console.log("✅ 优化亮点:");
  console.log("  • 直接存储操作 - 绕过 Solidity 抽象层");
  console.log("  • 手动槽位计算 - keccak256(key . slot)");
  console.log("  • 内存优化使用 - 复用 0x00, 0x20 位置");
  console.log("  • Unchecked 数学运算 - 跳过不必要的安全检查");
  console.log();
  console.log("⚠️  注意事项:");
  console.log("  • 需要深入了解 EVM 和存储布局");
  console.log("  • 代码可读性较差，需要详细注释");
  console.log("  • 适用于高频调用的核心函数");
  console.log("  • 需要充分测试确保正确性");
  console.log();

  console.log("🎉 Assembly 优化演示完成!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });