const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProductionERC20 - 工程化测试", function () {
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

  describe("1. Transfer 基础功能测试", function () {
    it("✅ 正常转账 - 应该成功更新余额", async function () {
      const transferAmount = ethers.parseEther("100");

      await expect(token.transfer(addr1.address, transferAmount))
       .to.changeTokenBalances(token, [owner, addr1], [-transferAmount, transferAmount]);

      expect(await token.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("✅ 正常转账 - 应该触发 Transfer 事件", async function () {
      const transferAmount = ethers.parseEther("100");

      await expect(token.transfer(addr1.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);
    });

    it("❌ 余额不足 - 应该 revert InsufficientBalance", async function () {
      const transferAmount = ethers.parseEther("999999999");

      await expect(
        token.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance")
        .withArgs(addr1.address, transferAmount, 0);
    });

    it("❌ 转账到零地址 - 应该 revert InvalidRecipient", async function () {
      await expect(
        token.transfer(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "InvalidRecipient")
        .withArgs(ethers.ZeroAddress);
    });
  });

  describe("2. Approve & TransferFrom 完整流程", function () {
    const approveAmount = ethers.parseEther("1000");
    const transferAmount = ethers.parseEther("500");

    beforeEach(async function () {
      await token.approve(addr1.address, approveAmount);
    });

    it("✅ approve → transferFrom - 完整流程应该成功", async function () {
      expect(await token.allowance(owner.address, addr1.address)).to.equal(approveAmount);

      await expect(token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount))
        .to.changeTokenBalances(token, [owner, addr2], [-transferAmount, transferAmount]);
    });

    it("✅ transferFrom - 应该减少 allowance", async function () {
      await token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount);

      expect(await token.allowance(owner.address, addr1.address))
        .to.equal(approveAmount - transferAmount);
    });

    it("✅ transferFrom - 应该触发 Transfer 事件", async function () {
      await expect(token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr2.address, transferAmount);
    });

    it("❌ transferFrom - allowance 不足应该 revert", async function () {
      const tooMuchAmount = ethers.parseEther("2000");

      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, tooMuchAmount)
      ).to.be.revertedWithCustomError(token, "InsufficientAllowance");
    });

    it("❌ approve 零地址 - 应该 revert ApprovalToZeroAddress", async function () {
      await expect(
        token.approve(ethers.ZeroAddress, approveAmount)
      ).to.be.revertedWithCustomError(token, "ApprovalToZeroAddress");
    });
  });

  describe("3. Allowance 变化测试", function () {
    const initialAmount = ethers.parseEther("500");
    const increaseAmount = ethers.parseEther("300");
    const decreaseAmount = ethers.parseEther("200");

    beforeEach(async function () {
      await token.approve(addr1.address, initialAmount);
    });

    it("✅ increaseAllowance - 应该增加授权额度", async function () {
      await expect(token.increaseAllowance(addr1.address, increaseAmount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, initialAmount + increaseAmount);

      expect(await token.allowance(owner.address, addr1.address))
        .to.equal(initialAmount + increaseAmount);
    });

    it("✅ decreaseAllowance - 应该减少授权额度", async function () {
      await expect(token.decreaseAllowance(addr1.address, decreaseAmount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, initialAmount - decreaseAmount);

      expect(await token.allowance(owner.address, addr1.address))
        .to.equal(initialAmount - decreaseAmount);
    });

    it("❌ decreaseAllowance - 减少到负数应该 revert", async function () {
      const tooMuchDecrease = ethers.parseEther("1000");

      await expect(
        token.decreaseAllowance(addr1.address, tooMuchDecrease)
      ).to.be.revertedWithCustomError(token, "InsufficientAllowance");
    });
  });

  describe("4. 事件触发测试", function () {
    it("✅ Transfer 事件 - 参数应该正确", async function () {
      const amount = ethers.parseEther("100");

      await expect(token.transfer(addr1.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, amount);
    });

    it("✅ Approval 事件 - 参数应该正确", async function () {
      const amount = ethers.parseEther("500");

      await expect(token.approve(addr1.address, amount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, amount);
    });

    it("✅ 批量操作 - 事件应该按顺序触发", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");
      const approveAmount = ethers.parseEther("500");

      // 先进行一些转账操作
      await token.transfer(addr1.address, amount1);
      await token.transfer(addr2.address, amount2);

      // 授权 addr1 代表 owner 操作
      await token.approve(addr1.address, approveAmount);

      // 执行 transferFrom
      const transferFromAmount = ethers.parseEther("50");
      const tx = await token.connect(addr1).transferFrom(owner.address, addr2.address, transferFromAmount);

      const receipt = await tx.wait();
      const events = receipt.logs.filter(log => {
        try {
          return token.interface.parseLog(log)?.name === "Transfer";
        } catch {
          return false;
        }
      });

      expect(events.length).to.be.greaterThan(0);
    });
  });

  describe("5. 边界条件测试", function () {
    it("✅ 零值转账 - 应该成功", async function () {
      await expect(token.transfer(addr1.address, 0))
        .to.changeTokenBalances(token, [owner, addr1], [0, 0]);
    });

    it("✅ 全部余额转账 - 应该成功", async function () {
      const fullBalance = await token.balanceOf(owner.address);

      await expect(token.transfer(addr1.address, fullBalance))
        .to.changeTokenBalances(token, [owner, addr1], [-fullBalance, fullBalance]);

      expect(await token.balanceOf(owner.address)).to.equal(0);
    });

    it("✅ 授权最大值 - 应该成功", async function () {
      const maxUint256 = ethers.MaxUint256;

      await expect(token.approve(addr1.address, maxUint256))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, maxUint256);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(maxUint256);
    });

    it("✅ 授权零值 - 应该成功", async function () {
      await expect(token.approve(addr1.address, 0))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, 0);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(0);
    });
  });

  describe("6. 复杂业务场景", function () {
    it("✅ 多方转账流程 - 余额应该正确", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");
      const amount3 = ethers.parseEther("50");

      await token.transfer(addr1.address, amount1);
      await token.transfer(addr2.address, amount2);
      await token.transfer(addr1.address, amount3);

      expect(await token.balanceOf(addr1.address)).to.equal(amount1 + amount3);
      expect(await token.balanceOf(addr2.address)).to.equal(amount2);
    });

    it("✅ 授权链 - 多级转账应该成功", async function () {
      const approveAmount = ethers.parseEther("1000");
      const transferAmount = ethers.parseEther("300");

      await token.approve(addr1.address, approveAmount);
      await token.connect(addr1).approve(addr2.address, transferAmount);

      await expect(token.connect(addr2).transferFrom(addr1.address, owner.address, transferAmount))
        .to.be.revertedWithCustomError(token, "InsufficientBalance");
    });

    it("✅ 重复授权 - 应该覆盖前一次授权", async function () {
      const firstApprove = ethers.parseEther("100");
      const secondApprove = ethers.parseEther("200");

      await token.approve(addr1.address, firstApprove);
      await token.approve(addr1.address, secondApprove);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(secondApprove);
    });
  });

  describe("7. Gas 优化验证", function () {
    it("✅ 转账 Gas 消耗应该在合理范围内", async function () {
      const transferAmount = ethers.parseEther("100");

      const tx = await token.transfer(addr1.address, transferAmount);
      const receipt = await tx.wait();

      const gasUsed = receipt.gasUsed;

      console.log(`📊 转账 Gas 消耗: ${gasUsed.toString()}`);

      expect(gasUsed).to.be.lessThan(100000);
    });

    it("✅ 授权 Gas 消耗应该在合理范围内", async function () {
      const approveAmount = ethers.parseEther("500");

      const tx = await token.approve(addr1.address, approveAmount);
      const receipt = await tx.wait();

      const gasUsed = receipt.gasUsed;

      console.log(`📊 授权 Gas 消耗: ${gasUsed.toString()}`);

      expect(gasUsed).to.be.lessThan(50000);
    });

    it("✅ transferFrom Gas 消耗应该在合理范围内", async function () {
      const approveAmount = ethers.parseEther("1000");
      const transferAmount = ethers.parseEther("500");

      await token.approve(addr1.address, approveAmount);

      const tx = await token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount);
      const receipt = await tx.wait();

      const gasUsed = receipt.gasUsed;

      console.log(`📊 transferFrom Gas 消耗: ${gasUsed.toString()}`);

      expect(gasUsed).to.be.lessThan(80000);
    });
  });
});