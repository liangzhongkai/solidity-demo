const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper function for hardhat-ethers v6
async function getBalance(address) {
  return await ethers.provider.send("eth_getBalance", [address, "latest"]);
}

/**
 * Day 2 - 任务 3: receive() vs fallback()
 *
 * EVM 调用路由规则：
 *
 * 1. 接收 ETH (msg.data 为空):
 *    - receive() → fallback() → error
 *
 * 2. 调用函数 (msg.data 不为空):
 *    - 匹配函数 → fallback() → error
 */
describe("ReceiveFallback - EVM 调用路由", function () {
  let demo, onlyReceive, onlyFallback, neither, callTarget;
  let owner, user1;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    const ReceiveFallbackDemo = await ethers.getContractFactory("ReceiveFallbackDemo");
    demo = await ReceiveFallbackDemo.deploy();
    await demo.waitForDeployment();

    const OnlyReceive = await ethers.getContractFactory("OnlyReceive");
    onlyReceive = await OnlyReceive.deploy();
    await onlyReceive.waitForDeployment();

    const OnlyFallback = await ethers.getContractFactory("OnlyFallback");
    onlyFallback = await OnlyFallback.deploy();
    await onlyFallback.waitForDeployment();

    const NeitherReceiveNorFallback = await ethers.getContractFactory("NeitherReceiveNorFallback");
    neither = await NeitherReceiveNorFallback.deploy();
    await neither.waitForDeployment();

    const CallTarget = await ethers.getContractFactory("CallTarget");
    callTarget = await CallTarget.deploy();
    await callTarget.waitForDeployment();
  });

  describe("任务 3.1: receive() 函数", function () {
    it("应该通过 call{value:}(\"\") 触发 receive()", async function () {
      const demoAddress = await demo.getAddress();

      // 重置标志
      await demo.resetFlags();

      // 纯 ETH 转账（空 calldata）
      const tx = await owner.sendTransaction({
        to: demoAddress,
        value: ethers.parseEther("1.0")
      });
      const receipt = await tx.wait();

      const receiveCalled = await demo.receiveCalled();
      const fallbackCalled = await demo.fallbackCalled();
      const balance = BigInt(await getBalance(demoAddress));

      console.log("\n========== 纯 ETH 转账 ==========");
      console.log("转账金额: 1 ETH");
      console.log("receive() 被调用:", receiveCalled);
      console.log("fallback() 被调用:", fallbackCalled);
      console.log("合约余额:", ethers.formatEther(balance));
      console.log("===============================\n");

      expect(receiveCalled).to.be.true;
      expect(fallbackCalled).to.be.false;
      expect(balance).to.equal(BigInt(ethers.parseEther("1.0")));
    });

    it("应该演示 receive() 不能有参数和返回值", async function () {
      // receive() 是特殊的函数，没有参数和返回值
      // 这个测试只是验证 receive 存在并且可以调用

      const tx = await owner.sendTransaction({
        to: await demo.getAddress(),
        value: ethers.parseEther("0.5")
      });
      await tx.wait();

      const valueReceived = await demo.getValue();
      expect(valueReceived).to.equal(ethers.parseEther("0.5"));
    });
  });

  describe("任务 3.2: fallback() 函数", function () {
    it("应该通过调用不存在的函数触发 fallback()", async function () {
      const demoAddress = await demo.getAddress();

      await demo.resetFlags();

      // 编造一个不存在的函数调用
      // 手动构造函数选择器 (函数签名的前4字节)
      const fakeFuncData = ethers.id("nonExistentFunction(uint256,address)").slice(0, 10);

      const tx = await owner.sendTransaction({
        to: demoAddress,
        data: fakeFuncData
      });
      await tx.wait();

      const receiveCalled = await demo.receiveCalled();
      const fallbackCalled = await demo.fallbackCalled();
      const lastCalldata = await demo.lastCalldata();

      console.log("\n========== 调用不存在的函数 ==========");
      console.log("函数选择器:", fakeFuncData);
      console.log("receive() 被调用:", receiveCalled);
      console.log("fallback() 被调用:", fallbackCalled);
      console.log("calldata:", lastCalldata);
      console.log("=====================================\n");

      expect(receiveCalled).to.be.false;
      expect(fallbackCalled).to.be.true;
      expect(lastCalldata).to.equal(fakeFuncData);
    });

    it("应该演示带 ETH 的不存在的函数调用也触发 fallback()", async function () {
      await demo.resetFlags();

      const demoAddress = await demo.getAddress();

      // 调用不存在的函数，同时发送 ETH
      // 手动构造函数选择器
      const fakeFuncData = ethers.id("someFakeFunction()").slice(0, 10);

      const tx = await owner.sendTransaction({
        to: demoAddress,
        value: ethers.parseEther("0.3"),
        data: fakeFuncData
      });
      await tx.wait();

      const receiveCalled = await demo.receiveCalled();
      const fallbackCalled = await demo.fallbackCalled();
      const valueReceived = await demo.valueReceived();

      console.log("\n========== 不存在的函数 + ETH ==========");
      console.log("receive() 被调用:", receiveCalled);
      console.log("fallback() 被调用:", fallbackCalled);
      console.log("接收的 ETH:", ethers.formatEther(valueReceived));
      console.log("======================================\n");

      // msg.data 不为空，所以不触发 receive，而是触发 fallback
      expect(receiveCalled).to.be.false;
      expect(fallbackCalled).to.be.true;
      expect(valueReceived).to.equal(ethers.parseEther("0.3"));
    });

    it("send with empty calldata → receive()，余额 +1", async function () {
      const demoAddress = await demo.getAddress();
      await demo.resetFlags();

      const balanceBefore = BigInt(await getBalance(demoAddress));

      await owner.sendTransaction({
        to: demoAddress,
        value: ethers.parseEther("1")
      });

      const balanceAfter = BigInt(await getBalance(demoAddress));
      expect(await demo.receiveCalled()).to.be.true;
      expect(await demo.fallbackCalled()).to.be.false;
      expect(balanceAfter).to.equal(balanceBefore + BigInt(ethers.parseEther("1")));
    });

    it("send with calldata → fallback() 而非 receive()", async function () {
      const demoAddress = await demo.getAddress();
      await demo.resetFlags();

      await owner.sendTransaction({
        to: demoAddress,
        data: "0x1234",
        value: ethers.parseEther("1")
      });

      expect(await demo.receiveCalled()).to.be.false;
      expect(await demo.fallbackCalled()).to.be.true;
      expect(await demo.lastCalldata()).to.equal("0x1234");
      expect(await demo.valueReceived()).to.equal(ethers.parseEther("1"));
    });
  });

  describe("任务 3.3: EVM 调用路由优先级", function () {
    it("应该演示: 只有 receive()", async function () {
      const onlyReceiveAddress = await onlyReceive.getAddress();

      // 纯 ETH 转账应该成功
      const tx1 = await owner.sendTransaction({
        to: onlyReceiveAddress,
        value: ethers.parseEther("1.0")
      });
      await tx1.wait();

      let balance = await onlyReceive.getBalance();
      let totalReceived = await onlyReceive.totalReceived();

      console.log("\n========== 只有 receive() ==========");
      console.log("纯 ETH 转账:");
      console.log("  合约余额:", ethers.formatEther(balance));
      console.log("  totalReceived:", totalReceived.toString());
      console.log("  成功!");
      console.log("===================================\n");

      expect(balance).to.equal(ethers.parseEther("1.0"));

      // 调用不存在的函数应该失败（没有 fallback）
      const fakeFuncData = ethers.id("fake()").slice(0, 10);

      await expect(
        owner.sendTransaction({
          to: onlyReceiveAddress,
          data: fakeFuncData
        })
      ).to.be.reverted;

      console.log("调用不存在的函数: 失败 (没有 fallback)");
    });

    it("应该演示: 只有 fallback()", async function () {
      const onlyFallbackAddress = await onlyFallback.getAddress();

      // 纯 ETH 转账应该触发 fallback（因为没有 receive）
      const tx1 = await owner.sendTransaction({
        to: onlyFallbackAddress,
        value: ethers.parseEther("1.0")
      });
      await tx1.wait();

      let balance = await onlyFallback.getBalance();
      let totalReceived = await onlyFallback.totalReceived();

      console.log("\n========== 只有 fallback() ==========");
      console.log("纯 ETH 转账:");
      console.log("  合约余额:", ethers.formatEther(balance));
      console.log("  totalReceived:", totalReceived.toString());
      console.log("  成功! (触发 fallback)");
      console.log("====================================\n");

      expect(balance).to.equal(ethers.parseEther("1.0"));

      // 调用不存在的函数也应该触发 fallback
      const fakeFuncData = ethers.id("fake()").slice(0, 10);

      const tx2 = await owner.sendTransaction({
        to: onlyFallbackAddress,
        data: fakeFuncData
      });
      await tx2.wait();

      const lastData = await onlyFallback.lastData();
      console.log("调用不存在的函数:");
      console.log("  成功! (触发 fallback)");
      console.log("  lastData:", lastData);
    });

    it("应该演示: 既没有 receive 也没有 fallback", async function () {
      const neitherAddress = await neither.getAddress();

      // 纯 ETH 转账应该失败
      await expect(
        owner.sendTransaction({
          to: neitherAddress,
          value: ethers.parseEther("1.0")
        })
      ).to.be.reverted;

      console.log("\n========== 没有 receive/fallback ==========");
      console.log("纯 ETH 转账: 失败!");
      console.log("调用不存在的函数: 失败!");
      console.log("==========================================\n");

      // 调用不存在的函数也应该失败
      const fakeFuncData = ethers.id("fake()").slice(0, 10);

      await expect(
        owner.sendTransaction({
          to: neitherAddress,
          data: fakeFuncData
        })
      ).to.be.reverted;

      // 但可以通过 deposit() 函数接收 ETH
      const tx = await neither.deposit({ value: ethers.parseEther("1.0") });
      await tx.wait();

      const balance = await neither.getBalance();
      expect(balance).to.equal(ethers.parseEther("1.0"));
      console.log("通过 deposit() 函数接收 ETH: 成功!");
    });

    it("应该演示同时有 receive 和 fallback 时的优先级", async function () {
      const demoAddress = await demo.getAddress();

      // 纯 ETH 转账 → receive()
      await demo.resetFlags();
      await owner.sendTransaction({
        to: demoAddress,
        value: ethers.parseEther("0.5")
      });

      expect(await demo.receiveCalled()).to.be.true;
      expect(await demo.fallbackCalled()).to.be.false;
      console.log("\n纯 ETH 转账 → receive() 被调用 ✓");

      // 调用不存在的函数 → fallback()
      await demo.resetFlags();
      const fakeFuncData = ethers.id("fake()").slice(0, 10);
      await owner.sendTransaction({
        to: demoAddress,
        data: fakeFuncData
      });

      expect(await demo.receiveCalled()).to.be.false;
      expect(await demo.fallbackCalled()).to.be.true;
      console.log("调用不存在函数 → fallback() 被调用 ✓");

      // 不存在的函数 + ETH → fallback() (不是 receive!)
      await demo.resetFlags();
      const prevValue = await demo.valueReceived();
      await owner.sendTransaction({
        to: demoAddress,
        value: ethers.parseEther("0.3"),
        data: fakeFuncData
      });

      expect(await demo.receiveCalled()).to.be.false;
      expect(await demo.fallbackCalled()).to.be.true;
      expect(await demo.valueReceived()).to.equal(prevValue + ethers.parseEther("0.3"));
      console.log("不存在函数 + ETH → fallback() 被调用 (msg.data 不为空) ✓");
    });
  });

  describe("任务 3.4: EVM 调用路由演示", function () {
    it("应该演示 call() 转账", async function () {
      const onlyReceiveAddress = await onlyReceive.getAddress();

      await callTarget.sendEther(onlyReceiveAddress, ethers.parseEther("1.0"), {
        value: ethers.parseEther("1.0")
      });

      const balance = await onlyReceive.getBalance();
      expect(balance).to.equal(ethers.parseEther("1.0"));

      console.log("\n========== call() 转账 ==========");
      console.log("成功转发 1 ETH");
      console.log("合约余额:", ethers.formatEther(balance));
      console.log("===============================\n");
    });

    it("应该演示调用不存在的函数", async function () {
      const demoAddress = await demo.getAddress();

      await callTarget.callNonExistentFunction(demoAddress);

      const fallbackCalled = await demo.fallbackCalled();
      expect(fallbackCalled).to.be.true;

      console.log("\n========== call 不存在的函数 ==========");
      console.log("通过 CallTarget 合约调用");
      console.log("Demo 的 fallback() 被触发");
      console.log("======================================\n");
    });
  });

  describe("任务 3.5: CallTarget 测试覆盖", function () {
    it("应该演示 sendWithSend() 转账成功（使用简单地址）", async function () {
      // send() 和 transfer() 有 2300 gas 限制
      // 只有非常简单的 receive/fallback 才能成功
      // 我们向一个普通地址（EOA）发送 ETH，这总是会成功

      // 直接向 user1 发送 ETH（EOA，总是成功）
      await owner.sendTransaction({
        to: await callTarget.getAddress(),
        value: ethers.parseEther("2.0")
      });

      await callTarget.sendWithSend(user1.address, ethers.parseEther("1.0"));

      const user1Balance = BigInt(await getBalance(user1.address));
      expect(user1Balance).to.be.greaterThan(0);

      console.log("\n========== sendWithSend() 成功 ==========");
      console.log(`成功向 EOA 转发 ${ethers.formatEther(user1Balance)} ETH`);
      console.log("========================================\n");
    });

    it("应该演示 sendWithSend() 转账失败（目标没有 receive/fallback）", async function () {
      const neitherAddress = await neither.getAddress();

      // NeitherReceiveNorFallback 没有 receive/fallback，send 会失败
      await expect(
        callTarget.sendWithSend(neitherAddress, ethers.parseEther("1.0"))
      ).to.be.revertedWith("send failed");

      console.log("\n========== sendWithSend() 失败 ==========");
      console.log("目标合约没有 receive/fallback");
      console.log("send() 返回 false，触发 require");
      console.log("==========================================\n");
    });

    it("应该演示 transferWithTransfer() 转账成功（使用 EOA）", async function () {
      // transfer() 也有 2300 gas 限制，只对 EOA 可靠

      await owner.sendTransaction({
        to: await callTarget.getAddress(),
        value: ethers.parseEther("2.0")
      });

      await callTarget.transferWithTransfer(user1.address, ethers.parseEther("1.0"));

      const user1Balance = BigInt(await getBalance(user1.address));
      expect(user1Balance).to.be.greaterThan(0);

      console.log("\n========== transferWithTransfer() 成功 ==========");
      console.log(`成功向 EOA 转发 ${ethers.formatEther(user1Balance)} ETH`);
      console.log("=================================================\n");
    });

    it("应该演示 transferWithTransfer() 转账失败", async function () {
      const neitherAddress = await neither.getAddress();

      // NeitherReceiveNorFallback 没有 receive/fallback，transfer 会失败
      await expect(
        callTarget.transferWithTransfer(neitherAddress, ethers.parseEther("1.0"))
      ).to.be.reverted;

      console.log("\n========== transferWithTransfer() 失败 ==========");
      console.log("目标合约没有 receive/fallback");
      console.log("transfer() 触发 revert");
      console.log("=================================================\n");
    });

    it("应该演示 CallTarget 的 receive() 函数", async function () {
      // 直接向 CallTarget 发送 ETH，触发其 receive()
      await owner.sendTransaction({
        to: await callTarget.getAddress(),
        value: ethers.parseEther("1.0")
      });

      // 验证 CallTarget 接收了 ETH（receive() 只是 emit 事件，不存储）
      // 实际上 ETH 会留在 CallTarget 中
      const balance = await getBalance(await callTarget.getAddress());
      expect(BigInt(balance)).to.equal(BigInt(ethers.parseEther("1.0")));

      console.log("\n========== CallTarget.receive() ==========");
      console.log("CallTarget 成功接收 ETH");
      console.log("余额:", ethers.formatEther(balance));
      console.log("==========================================\n");
    });

    it("应该演示 sendWithSend() 的 gas 限制问题", async function () {
      // 部署一个简单的接收合约（只有 payable receive，没有存储操作）
      // 由于 OnlyReceive 有存储操作，它会超过 2300 gas 限制

      // 测试：向 OnlyReceive 发送会失败，因为它的 receive() 写入存储
      await owner.sendTransaction({
        to: await callTarget.getAddress(),
        value: ethers.parseEther("2.0")
      });

      const onlyReceiveAddress = await onlyReceive.getAddress();

      // 这会失败，因为 OnlyReceive 的 receive() 写入存储（超过 2300 gas）
      await expect(
        callTarget.sendWithSend(onlyReceiveAddress, ethers.parseEther("1.0"))
      ).to.be.revertedWith("send failed");

      console.log("\n========== sendWithSend() Gas 限制演示 ==========");
      console.log("OnlyReceive.receive() 写入存储");
      console.log("超过 2300 gas 限制，send() 失败");
      console.log("================================================\n");
    });

    it("应该演示 transferWithTransfer() 的 gas 限制问题", async function () {
      // transfer() 也有同样的 gas 限制问题

      await owner.sendTransaction({
        to: await callTarget.getAddress(),
        value: ethers.parseEther("2.0")
      });

      const onlyReceiveAddress = await onlyReceive.getAddress();

      // 这会失败，因为 OnlyReceive 的 receive() 写入存储
      await expect(
        callTarget.transferWithTransfer(onlyReceiveAddress, ethers.parseEther("1.0"))
      ).to.be.reverted;

      console.log("\n========== transferWithTransfer() Gas 限制演示 ==========");
      console.log("OnlyReceive.receive() 写入存储");
      console.log("超过 2300 gas 限制，transfer() 失败");
      console.log("======================================================\n");
    });
  });

  describe("任务 3.6: ReceiveFallbackDemo 辅助函数测试", function () {
    it("应该测试 setValue() 和 getValue() 函数", async function () {
      const demoAddress = await demo.getAddress();

      // setValue() 触发 FunctionCalled 事件
      const tx = await demo.setValue(42);
      const receipt = await tx.wait();

      // getValue() 返回 valueReceived
      const value = await demo.getValue();
      expect(value).to.equal(0); // setValue 不修改 valueReceived

      console.log("\n========== setValue/getValue 测试 ==========");
      console.log("setValue(42) 调用成功");
      console.log("getValue() 返回:", value.toString());
      console.log("===========================================\n");
    });

    it("应该测试 withdraw() 函数", async function () {
      const demoAddress = await demo.getAddress();

      // 向 demo 发送 ETH
      await owner.sendTransaction({
        to: demoAddress,
        value: ethers.parseEther("1.0")
      });

      const balanceBefore = BigInt(await getBalance(demoAddress));
      expect(balanceBefore).to.equal(BigInt(ethers.parseEther("1.0")));

      // owner 可以 withdraw
      const ownerBalanceBefore = BigInt(await getBalance(owner.address));

      const tx = await demo.withdraw();
      const receipt = await tx.wait();

      const balanceAfter = BigInt(await getBalance(demoAddress));
      const ownerBalanceAfter = BigInt(await getBalance(owner.address));

      expect(balanceAfter).to.equal(0);
      expect(ownerBalanceAfter).to.be.greaterThan(ownerBalanceBefore);

      console.log("\n========== withdraw() 测试 ==========");
      console.log("合约余额:", ethers.formatEther(balanceBefore));
      console.log("取款后余额:", ethers.formatEther(balanceAfter));
      console.log("======================================\n");
    });

    it("应该测试 withdraw() 的权限检查", async function () {
      const demoAddress = await demo.getAddress();

      // 向 demo 发送 ETH
      await owner.sendTransaction({
        to: demoAddress,
        value: ethers.parseEther("1.0")
      });

      // 非 owner 调用 withdraw 应该失败
      const demoAsUser = demo.connect(user1);
      await expect(demoAsUser.withdraw()).to.be.revertedWith("not owner");

      console.log("\n========== withdraw() 权限测试 ==========");
      console.log("非 owner 调用 withdraw 失败");
      console.log("========================================\n");
    });

    it("应该测试 getBalance() 函数", async function () {
      const demoAddress = await demo.getAddress();

      // 向 demo 发送 ETH
      await owner.sendTransaction({
        to: demoAddress,
        value: ethers.parseEther("2.5")
      });

      const balance = await demo.getBalance();
      expect(balance).to.equal(ethers.parseEther("2.5"));

      console.log("\n========== getBalance() 测试 ==========");
      console.log("合约余额:", ethers.formatEther(balance));
      console.log("======================================\n");
    });

    it("应该测试 resetFlags() 函数", async function () {
      // 先触发 receive
      await owner.sendTransaction({
        to: await demo.getAddress(),
        value: ethers.parseEther("1.0")
      });

      let receiveCalled = await demo.receiveCalled();
      let fallbackCalled = await demo.fallbackCalled();

      expect(receiveCalled).to.be.true;

      // 重置标志
      await demo.resetFlags();

      receiveCalled = await demo.receiveCalled();
      fallbackCalled = await demo.fallbackCalled();

      expect(receiveCalled).to.be.false;
      expect(fallbackCalled).to.be.false;

      console.log("\n========== resetFlags() 测试 ==========");
      console.log("标志已重置");
      console.log("receiveCalled:", receiveCalled);
      console.log("fallbackCalled:", fallbackCalled);
      console.log("======================================\n");
    });
  });

  describe("任务 3.7: 完整的调用路由表", function () {
    it("应该打印完整的 EVM 调用路由决策树", async function () {
      console.log("\n===========================================");
      console.log("        EVM 调用路由决策树");
      console.log("===========================================");
      console.log("");
      console.log("接收调用");
      console.log("    │");
      console.log("    ├─ msg.value == 0 (无 ETH)");
      console.log("    │   │");
      console.log("    │   ├─ 匹配函数 → 执行函数");
      console.log("    │   ├─ 不匹配函数");
      console.log("    │   │   ├─ 有 fallback() → 执行 fallback()");
      console.log("    │   │   └─ 无 fallback() → REVERT");
      console.log("    │");
      console.log("    └─ msg.value > 0 (有 ETH)");
      console.log("        │");
      console.log("        ├─ msg.data == \"\" (空 data, 纯转账)");
      console.log("        │   ├─ 有 receive() → 执行 receive()");
      console.log("        │   ├─ 无 receive() + 有 fallback() → 执行 fallback()");
      console.log("        │   └─ 都没有 → REVERT");
      console.log("        │");
      console.log("        └─ msg.data != \"\" (有 data)");
      console.log("            ├─ 匹配函数 → 执行函数");
      console.log("            ├─ 不匹配函数");
      console.log("            │   ├─ 有 fallback() payable → 执行 fallback()");
      console.log("            │   └─ 无 fallback() → REVERT");
      console.log("");
      console.log("===========================================");
      console.log("");
      console.log("关键点:");
      console.log("1. receive() 只在 msg.data == \"\" 时触发");
      console.log("2. fallback() 处理所有未匹配的函数调用");
      console.log("3. receive() 优先级 > fallback() (纯转账时)");
      console.log("4. 函数匹配 > fallback() (函数调用时)");
      console.log("===========================================\n");
    });
  });
});
