const { expect } = require("chai");
const { ethers } = require("hardhat");

async function getStorageAt(address, slot) {
  return await ethers.provider.send("eth_getStorageAt", [address, slot, "latest"]);
}

function toStorageHex(value) {
  return ethers.toBeHex(BigInt(value), 32);
}

describe("Provider Test", function () {
  it("should return valid 32-byte hex from eth_getStorageAt", async function () {
    const [signer] = await ethers.getSigners();
    const Test = await ethers.getContractFactory("MappingSlot");
    const test = await Test.deploy();
    const address = await test.getAddress();

    const slot0 = await getStorageAt(address, "0x0");

    expect(slot0).to.be.a("string");
    expect(slot0).to.match(/^0x[0-9a-fA-F]{64}$/);
  });

  it("should read storage value via send and match contract state", async function () {
    const [signer] = await ethers.getSigners();
    const Test = await ethers.getContractFactory("MappingSlot");
    const test = await Test.deploy();
    const address = await test.getAddress();

    const testAmount = 12345;
    await test.setBalance(signer.address, testAmount);

    const key = ethers.zeroPadValue(signer.address, 32);
    const slot = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [key, 0])
    );

    const storageValue = await getStorageAt(address, slot);
    const expectedValue = toStorageHex(testAmount);

    expect(storageValue).to.equal(expectedValue);
  });
});
