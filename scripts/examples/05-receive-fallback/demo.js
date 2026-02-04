const hre = require("hardhat");

/**
 * Day 2 - 任务 3 演示脚本
 * receive() vs fallback() - EVM 调用路由
 */
async function main() {
  console.log("\n========== Day 2: receive() vs fallback() ==========\n");

  const [owner] = await ethers.getSigners();
  console.log("部署账户:", owner.address);

  // 部署合约
  console.log("\n部署合约...");

  const ReceiveFallbackDemo = await ethers.getContractFactory("ReceiveFallbackDemo");
  const demo = await ReceiveFallbackDemo.deploy();
  await demo.waitForDeployment();
  const demoAddress = await demo.getAddress();
  console.log("ReceiveFallbackDemo 地址:", demoAddress);

  const OnlyReceive = await ethers.getContractFactory("OnlyReceive");
  const onlyReceive = await OnlyReceive.deploy();
  await onlyReceive.waitForDeployment();
  console.log("OnlyReceive 地址:", await onlyReceive.getAddress());

  const OnlyFallback = await ethers.getContractFactory("OnlyFallback");
  const onlyFallback = await OnlyFallback.deploy();
  await onlyFallback.waitForDeployment();
  console.log("OnlyFallback 地址:", await onlyFallback.getAddress());

  // 演示 1: 纯 ETH 转账触发 receive()
  console.log("\n--- 演示 1: 纯 ETH 转账 ---");
  await demo.resetFlags();

  const tx1 = await owner.sendTransaction({
    to: demoAddress,
    value: ethers.utils.parseEther("1.0")
  });
  await tx1.wait();

  const receiveCalled = await demo.receiveCalled();
  const fallbackCalled = await demo.fallbackCalled();
  const valueReceived = await demo.valueReceived();

  console.log("转账 1 ETH:");
  console.log("  receive() 被调用:", receiveCalled);
  console.log("  fallback() 被调用:", fallbackCalled);
  console.log("  valueReceived:", ethers.utils.formatEther(valueReceived));
  console.log("  结论: msg.data 为空 → 触发 receive()");

  // 演示 2: 调用不存在的函数触发 fallback()
  console.log("\n--- 演示 2: 调用不存在的函数 ---");
  await demo.resetFlags();

  // 编造一个不存在的函数签名
  const fakeSelector = ethers.utils.id("nonExistentFunction(uint256)").slice(0, 10);

  const tx2 = await owner.sendTransaction({
    to: demoAddress,
    data: fakeSelector
  });
  await tx2.wait();

  const receiveCalled2 = await demo.receiveCalled();
  const fallbackCalled2 = await demo.fallbackCalled();
  const lastCalldata = await demo.lastCalldata();

  console.log("调用不存在的函数:");
  console.log("  函数选择器:", fakeSelector);
  console.log("  receive() 被调用:", receiveCalled2);
  console.log("  fallback() 被调用:", fallbackCalled2);
  console.log("  calldata:", lastCalldata);
  console.log("  结论: 函数不匹配 → 触发 fallback()");

  // 演示 3: 不存在的函数 + ETH
  console.log("\n--- 演示 3: 不存在的函数 + ETH ---");
  await demo.resetFlags();

  const prevValue = await demo.valueReceived();

  const tx3 = await owner.sendTransaction({
    to: demoAddress,
    value: ethers.utils.parseEther("0.5"),
    data: fakeSelector
  });
  await tx3.wait();

  const receiveCalled3 = await demo.receiveCalled();
  const fallbackCalled3 = await demo.fallbackCalled();
  const newValue = await demo.valueReceived();

  console.log("不存在的函数 + 0.5 ETH:");
  console.log("  receive() 被调用:", receiveCalled3);
  console.log("  fallback() 被调用:", fallbackCalled3);
  console.log("  增加的 value:", ethers.utils.formatEther(newValue.sub(prevValue)));
  console.log("  结论: msg.data 不为空 → 触发 fallback() (即使有 ETH!)");

  // 演示 4: 只有 receive() 的合约
  console.log("\n--- 演示 4: 只有 receive() 的合约 ---");
  const onlyReceiveAddress = await onlyReceive.getAddress();

  const tx4 = await owner.sendTransaction({
    to: onlyReceiveAddress,
    value: ethers.utils.parseEther("1.0")
  });
  await tx4.wait();

  const onlyReceiveBalance = await onlyReceive.getBalance();
  console.log("纯 ETH 转账: 成功");
  console.log("  余额:", ethers.utils.formatEther(onlyReceiveBalance));

  // 尝试调用不存在的函数（应该失败）
  try {
    await owner.sendTransaction({
      to: onlyReceiveAddress,
      data: fakeSelector
    });
    console.log("调用不存在的函数: 不应该到这里");
  } catch (e) {
    console.log("调用不存在的函数: 失败 (没有 fallback)");
  }

  // 演示 5: 只有 fallback() 的合约
  console.log("\n--- 演示 5: 只有 fallback() 的合约 ---");
  const onlyFallbackAddress = await onlyFallback.getAddress();

  const tx5 = await owner.sendTransaction({
    to: onlyFallbackAddress,
    value: ethers.utils.parseEther("1.0")
  });
  await tx5.wait();

  const onlyFallbackBalance = await onlyFallback.getBalance();
  console.log("纯 ETH 转账: 成功 (触发 fallback)");
  console.log("  余额:", ethers.utils.formatEther(onlyFallbackBalance));

  const tx6 = await owner.sendTransaction({
    to: onlyFallbackAddress,
    data: fakeSelector
  });
  await tx6.wait();

  const lastData = await onlyFallback.lastData();
  console.log("调用不存在的函数: 成功 (触发 fallback)");
  console.log("  lastData:", lastData);

  // 总结
  console.log("\n========== EVM 调用路由总结 ==========");
  console.log("");
  console.log("msg.data 为空 (纯转账):");
  console.log("  1. 有 receive() → receive()");
  console.log("  2. 无 receive() + 有 fallback() → fallback()");
  console.log("  3. 都没有 → REVERT");
  console.log("");
  console.log("msg.data 不为空 (函数调用):");
  console.log("  1. 匹配函数 → 执行函数");
  console.log("  2. 不匹配 + 有 fallback() → fallback()");
  console.log("  3. 不匹配 + 无 fallback() → REVERT");
  console.log("");
  console.log("关键要点:");
  console.log("  • receive() 只处理纯 ETH 转账 (msg.data == \"\")");
  console.log("  • fallback() 处理所有未匹配的调用");
  console.log("  • 如果有 ETH 且 msg.data 不为空，仍然走 fallback()!");
  console.log("  • receive() 优先级高于 fallback() (仅限纯转账)");
  console.log("");
  console.log("======================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
