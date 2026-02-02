const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting Production ERC20 Token Deployment...\n");

  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deployment parameters
  const tokenName = "My Production Token";
  const tokenSymbol = "MPT";
  const tokenDecimals = 18;
  const initialSupply = hre.ethers.parseEther("1000000"); // 1 million tokens

  console.log("🪙 Token Configuration:");
  console.log("  Name:", tokenName);
  console.log("  Symbol:", tokenSymbol);
  console.log("  Decimals:", tokenDecimals);
  console.log("  Initial Supply:", hre.ethers.formatEther(initialSupply), "tokens\n");

  // Deploy contract
  console.log("⏳ Deploying ProductionERC20 contract...");
  const ProductionERC20 = await hre.ethers.getContractFactory("ProductionERC20");
  const token = await ProductionERC20.deploy(
    tokenName,
    tokenSymbol,
    tokenDecimals,
    initialSupply,
    deployer.address
  );

  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("✅ Contract deployed successfully!");
  console.log("📍 Token Address:", tokenAddress, "\n");

  // Verify deployment
  console.log("🔍 Verifying deployment...");
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const deployerBalance = await token.balanceOf(deployer.address);

  console.log("✅ Deployment verified:");
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Decimals:", decimals.toString());
  console.log("  Total Supply:", hre.ethers.formatEther(totalSupply), "tokens");
  console.log("  Deployer Balance:", hre.ethers.formatEther(deployerBalance), "tokens\n");

  // Demo transactions
  console.log("🎯 Running demo transactions...\n");

  // Get test accounts
  const [_, addr1, addr2] = await hre.ethers.getSigners();

  // Transfer demo
  const transferAmount = hre.ethers.parseEther("1000");
  console.log("💸 Transferring", hre.ethers.formatEther(transferAmount), "tokens to", addr1.address);
  const tx1 = await token.transfer(addr1.address, transferAmount);
  await tx1.wait();
  console.log("✅ Transfer confirmed. Transaction hash:", tx1.hash);

  const addr1Balance = await token.balanceOf(addr1.address);
  console.log("📊 Addr1 Balance:", hre.ethers.formatEther(addr1Balance), "tokens\n");

  // Approval demo
  const approveAmount = hre.ethers.parseEther("500");
  console.log("🙏 Approving", addr2.address, "to spend", hre.ethers.formatEther(approveAmount), "tokens");
  const tx2 = await token.approve(addr2.address, approveAmount);
  await tx2.wait();
  console.log("✅ Approval confirmed. Transaction hash:", tx2.hash);

  const allowance = await token.allowance(deployer.address, addr2.address);
  console.log("📊 Allowance:", hre.ethers.formatEther(allowance), "tokens\n");

  // TransferFrom demo
  const transferFromAmount = hre.ethers.parseEther("200");
  console.log("🔄 Executing transferFrom:", addr2.address, "transferring",
              hre.ethers.formatEther(transferFromAmount), "tokens from deployer to addr1");
  const tx3 = await token.connect(addr2).transferFrom(deployer.address, addr1.address, transferFromAmount);
  await tx3.wait();
  console.log("✅ TransferFrom confirmed. Transaction hash:", tx3.hash);

  const newAddr1Balance = await token.balanceOf(addr1.address);
  const newDeployerBalance = await token.balanceOf(deployer.address);
  console.log("📊 New Addr1 Balance:", hre.ethers.formatEther(newAddr1Balance), "tokens");
  console.log("📊 New Deployer Balance:", hre.ethers.formatEther(newDeployerBalance), "tokens\n");

  // Final state
  console.log("📈 Final Token Distribution:");
  console.log("  Deployer:", hre.ethers.formatEther(newDeployerBalance), "tokens");
  console.log("  Addr1:", hre.ethers.formatEther(newAddr1Balance), "tokens");
  console.log("  Total Supply:", hre.ethers.formatEther(await token.totalSupply()), "tokens\n");

  console.log("🎉 Deployment and demo completed successfully!");
  console.log("📋 Contract Summary:");
  console.log("  Address:", tokenAddress);
  console.log("  Network:", hre.network.name);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });