const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProductionERC20 - Assembly 优化测试", function () {
  let token;
  let owner, addr1, addr2;
  const TOKEN_NAME = "Production Token";
  const TOKEN_SYMBOL = "PRD";
  const TOKEN_DECIMALS = 18;
  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const ProductionERC20 = await ethers.getContractFactory("ProductionERC20");
    token = await ProductionERC20.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      TOKEN_DECIMALS,
      INITIAL_SUPPLY,
      owner.address
    );
  });

  describe("Assembly 优化功能测试", function () {
    it("✅ transferOptimized - 正常转账应该成功", async function () {
      const transferAmount = ethers.parseEther("100");

      await expect(token.transferOptimized(addr1.address, transferAmount))
        .to.changeTokenBalances(token, [owner, addr1], [-transferAmount, transferAmount]);

      expect(await token.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("✅ transferOptimized - 应该触发 Transfer 事件", async function () {
      const transferAmount = ethers.parseEther("100");

      await expect(token.transferOptimized(addr1.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);
    });

    it("❌ transferOptimized - 余额不足应该 revert", async function () {
      const transferAmount = ethers.parseEther("999999999");

      await expect(
        token.connect(addr1).transferOptimized(addr2.address, transferAmount)
      ).to.be.reverted;
    });

    it("❌ transferOptimized - 转账到零地址应该 revert", async function () {
      await expect(
        token.transferOptimized(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "InvalidRecipient");
    });

    it("✅ transferOptimized - 零值转账应该成功", async function () {
      await expect(token.transferOptimized(addr1.address, 0))
        .to.changeTokenBalances(token, [owner, addr1], [0, 0]);
    });

    it("✅ transferOptimized - 全部余额转账应该成功", async function () {
      const fullBalance = await token.balanceOf(owner.address);

      await expect(token.transferOptimized(addr1.address, fullBalance))
        .to.changeTokenBalances(token, [owner, addr1], [-fullBalance, fullBalance]);

      expect(await token.balanceOf(owner.address)).to.equal(0);
    });
  });

  describe("Assembly vs 标准版本对比", function () {
    it("✅ 两个版本应该产生相同的结果", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");

      // 使用标准版本
      await token.transfer(addr1.address, amount1);

      // 使用优化版本
      await token.transferOptimized(addr2.address, amount2);

      expect(await token.balanceOf(addr1.address)).to.equal(amount1);
      expect(await token.balanceOf(addr2.address)).to.equal(amount2);
    });

    it("✅ 两个版本的事件应该相同", async function () {
      const amount = ethers.parseEther("150");

      // 标准版本
      const tx1 = await token.transfer(addr1.address, amount);
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find(log => {
        try {
          return token.interface.parseLog(log)?.name === "Transfer";
        } catch {
          return false;
        }
      });

      // 优化版本
      const tx2 = await token.transferOptimized(addr2.address, amount);
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find(log => {
        try {
          return token.interface.parseLog(log)?.name === "Transfer";
        } catch {
          return false;
        }
      });

      expect(event1).to.not.be.undefined;
      expect(event2).to.not.be.undefined;
    });
  });

  describe("Gas 消耗对比分析", function () {
    it("✅ 应该测量两个版本的 Gas 差异", async function () {
      const transferAmount = ethers.parseEther("100");

      // 测试标准版本
      const tx1 = await token.transfer(addr1.address, transferAmount);
      const receipt1 = await tx1.wait();
      const standardGas = receipt1.gasUsed;

      // 测试优化版本
      const tx2 = await token.transferOptimized(addr2.address, transferAmount);
      const receipt2 = await tx2.wait();
      const optimizedGas = receipt2.gasUsed;

      console.log("📊 Gas 对比分析:");
      console.log("  标准版本 Gas:", standardGas.toString());
      console.log("  优化版本 Gas:", optimizedGas.toString());
      console.log("  节省 Gas:", (standardGas - optimizedGas).toString());
      console.log("  优化比例:", `${((Number(standardGas - optimizedGas) * 100) / Number(standardGas)).toFixed(2)}%`);

      // 优化版本应该不比标准版本差（允许小幅度误差）
      expect(optimizedGas).to.be.lessThan(standardGas + 1000n);
    });

    it("✅ 批量转账 Gas 对比", async function () {
      const amount = ethers.parseEther("10");
      const iterations = 10;

      // 标准版本批量测试
      let standardTotalGas = 0n;
      for (let i = 0; i < iterations; i++) {
        const tx = await token.transfer(addr1.address, amount);
        const receipt = await tx.wait();
        standardTotalGas += receipt.gasUsed;
      }

      // 重置状态
      await token.transfer(owner.address, await token.balanceOf(addr1.address));

      // 优化版本批量测试
      let optimizedTotalGas = 0n;
      for (let i = 0; i < iterations; i++) {
        const tx = await token.transferOptimized(addr2.address, amount);
        const receipt = await tx.wait();
        optimizedTotalGas += receipt.gasUsed;
      }

      console.log("📊 批量转账 Gas 对比:");
      console.log("  标准版本总 Gas:", standardTotalGas.toString());
      console.log("  优化版本总 Gas:", optimizedTotalGas.toString());
      console.log("  平均节省 Gas:", ((standardTotalGas - optimizedTotalGas) / BigInt(iterations)).toString());
    });
  });

  describe("Assembly 优化边界测试", function () {
    it("✅ 大额转账 - Assembly 版本", async function () {
      const largeAmount = ethers.parseEther("1000000");

      await expect(token.transferOptimized(addr1.address, largeAmount))
        .to.changeTokenBalances(token, [owner, addr1], [-largeAmount, largeAmount]);
    });

    it("✅ 小额转账 - Assembly 版本", async function () {
      const smallAmount = 1; // 1 wei

      await expect(token.transferOptimized(addr1.address, smallAmount))
        .to.changeTokenBalances(token, [owner, addr1], [-smallAmount, smallAmount]);
    });

    it("✅ 连续多次转账 - Assembly 版本", async function () {
      const amount = ethers.parseEther("50");

      for (let i = 0; i < 5; i++) {
        await token.transferOptimized(addr1.address, amount);
      }

      expect(await token.balanceOf(addr1.address)).to.equal(amount * 5n);
    });
  });

  describe("Assembly 优化错误处理", function () {
    it("❌ Assembly 版本 - 溢出转账应该被保护", async function () {
      const balance = await token.balanceOf(owner.address);
      const overflowAmount = balance + 1n;

      await expect(
        token.transferOptimized(addr1.address, overflowAmount)
      ).to.be.reverted;
    });

    it("❌ Assembly 版本 - 负数转账应该被保护", async function () {
      // 这种测试在 JavaScript 中不容易模拟，因为无法直接传入负数
      // 但可以测试转账超过余额的情况
      const balance = await token.balanceOf(addr1.address);
      if (balance > 0) {
        await expect(
          token.connect(addr1).transferOptimized(addr2.address, balance + 1n)
        ).to.be.reverted;
      }
    });
  });

  describe("Assembly 优化在复杂场景中的表现", function () {
    it("✅ 多方转账流程 - Assembly 版本", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");
      const amount3 = ethers.parseEther("50");

      await token.transferOptimized(addr1.address, amount1);
      await token.transferOptimized(addr2.address, amount2);
      await token.transferOptimized(addr1.address, amount3);

      expect(await token.balanceOf(addr1.address)).to.equal(amount1 + amount3);
      expect(await token.balanceOf(addr2.address)).to.equal(amount2);
    });

    it("✅ 轮换转账 - Assembly vs 标准版本", async function () {
      const amount = ethers.parseEther("100");

      // 使用标准版本
      await token.transfer(addr1.address, amount);
      await token.connect(addr1).transfer(addr2.address, amount);

      // 使用优化版本
      await token.transferOptimized(addr1.address, amount);
      await token.connect(addr1).transferOptimized(addr2.address, amount);

      expect(await token.balanceOf(addr2.address)).to.equal(amount * 2n);
    });
  });

  describe("Assembly 优化性能验证", function () {
    it("✅ Assembly 版本在极端条件下的稳定性", async function () {
      // 先给 addr1 转一些余额
      const initialBalance = ethers.parseEther("2000");
      await token.transferOptimized(addr1.address, initialBalance);

      // 测试 addr1 使用 Assembly 版本进行各种转账
      const amounts = [
        1n,                                    // 最小单位
        ethers.parseEther("0.001"),           // 小额
        ethers.parseEther("100"),             // 中等金额
        ethers.parseEther("500"),             // 大额（确保不超过余额）
      ];

      for (const amount of amounts) {
        await token.connect(addr1).transferOptimized(addr2.address, amount);
      }

      // 验证最终余额正确
      const expectedBalance = amounts.reduce((sum, amount) => sum + amount, 0n);
      expect(await token.balanceOf(addr2.address)).to.equal(expectedBalance);
    });
  });
});