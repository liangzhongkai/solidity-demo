const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Provider Test", function () {
  it("should test send method", async function () {
    const [signer] = await ethers.getSigners();
    // Deploy a simple contract to test
    const Test = await ethers.getContractFactory("MappingSlot");
    const test = await Test.deploy();
    const address = await test.getAddress();
    
    // Try using send with eth_getStorageAt
    try {
      const slot0 = await ethers.provider.send("eth_getStorageAt", [address, "0x0", "latest"]);
      console.log("send eth_getStorageAt works:", slot0);
    } catch (e) {
      console.log("send error:", e.message);
    }
  });
});
