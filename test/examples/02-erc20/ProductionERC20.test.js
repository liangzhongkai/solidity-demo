const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProductionERC20", function () {
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

  describe("Deployment", function () {
    it("Should set the correct name, symbol and decimals", async function () {
      expect(await token.name()).to.equal(TOKEN_NAME);
      expect(await token.symbol()).to.equal(TOKEN_SYMBOL);
      expect(await token.decimals()).to.equal(TOKEN_DECIMALS);
    });

    it("Should assign all tokens to the owner", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should set the total supply correctly", async function () {
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("100");

      await expect(token.transfer(addr1.address, transferAmount))
       .to.changeTokenBalances(token, [owner, addr1], [-transferAmount, transferAmount]);

      expect(await token.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("Should fail when transferring to zero address", async function () {
      await expect(
        token.transfer(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "InvalidRecipient");
    });

    it("Should fail when sender doesn't have enough tokens", async function () {
      const transferAmount = ethers.parseEther("999999999");
      await expect(
        token.connect(addr1).transfer(addr2.address, transferAmount)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });
  });

  describe("Approvals", function () {
    it("Should approve spender", async function () {
      await expect(token.approve(addr1.address, ethers.parseEther("100")))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, ethers.parseEther("100"));

      expect(await token.allowance(owner.address, addr1.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should fail when approving zero address", async function () {
      await expect(
        token.approve(ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "ApprovalToZeroAddress");
    });

    it("Should increase allowance", async function () {
      await token.approve(addr1.address, ethers.parseEther("100"));

      await expect(token.increaseAllowance(addr1.address, ethers.parseEther("50")))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, ethers.parseEther("150"));

      expect(await token.allowance(owner.address, addr1.address)).to.equal(ethers.parseEther("150"));
    });

    it("Should decrease allowance", async function () {
      await token.approve(addr1.address, ethers.parseEther("100"));

      await expect(token.decreaseAllowance(addr1.address, ethers.parseEther("30")))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, ethers.parseEther("70"));

      expect(await token.allowance(owner.address, addr1.address)).to.equal(ethers.parseEther("70"));
    });

    it("Should fail when decreasing allowance below zero", async function () {
      await token.approve(addr1.address, ethers.parseEther("100"));

      await expect(
        token.decreaseAllowance(addr1.address, ethers.parseEther("101"))
      ).to.be.revertedWithCustomError(token, "InsufficientAllowance");
    });
  });

  describe("TransferFrom", function () {
    beforeEach(async function () {
      await token.approve(addr1.address, ethers.parseEther("1000"));
    });

    it("Should transfer tokens on behalf of owner", async function () {
      const transferAmount = ethers.parseEther("500");

      await expect(token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount))
        .to.changeTokenBalances(token, [owner, addr2], [-transferAmount, transferAmount]);
    });

    it("Should decrease allowance on transferFrom", async function () {
      const transferAmount = ethers.parseEther("500");
      await token.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount);

      expect(await token.allowance(owner.address, addr1.address)).to.equal(ethers.parseEther("500"));
    });

    it("Should fail when allowance is insufficient", async function () {
      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, ethers.parseEther("2000"))
      ).to.be.revertedWithCustomError(token, "InsufficientAllowance");
    });

    it("Should fail when transferring from zero address", async function () {
      await expect(
        token.connect(addr1).transferFrom(ethers.ZeroAddress, addr2.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(token, "InvalidRecipient");
    });
  });

  describe("Events", function () {
    it("Should emit Transfer event on transfer", async function () {
      await expect(token.transfer(addr1.address, ethers.parseEther("100")))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, ethers.parseEther("100"));
    });

    it("Should emit Approval event on approve", async function () {
      await expect(token.approve(addr1.address, ethers.parseEther("100")))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, ethers.parseEther("100"));
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero transfers", async function () {
      await expect(token.transfer(addr1.address, 0))
        .to.changeTokenBalances(token, [owner, addr1], [0, 0]);
    });

    it("Should handle maximum uint256 values", async function () {
      const maxUint256 = ethers.MaxUint256;
      await token.approve(addr1.address, maxUint256);
      expect(await token.allowance(owner.address, addr1.address)).to.equal(maxUint256);
    });

    it("Should handle multiple transfers correctly", async function () {
      const amount1 = ethers.parseEther("100");
      const amount2 = ethers.parseEther("200");
      const amount3 = ethers.parseEther("50");

      await token.transfer(addr1.address, amount1);
      await token.transfer(addr2.address, amount2);
      await token.transfer(addr1.address, amount3);

      expect(await token.balanceOf(addr1.address)).to.equal(amount1 + amount3);
      expect(await token.balanceOf(addr2.address)).to.equal(amount2);
    });
  });
});