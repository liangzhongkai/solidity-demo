require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: false,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts/examples",
    tests: "./test/examples"
  },
  networks: {
    hardhat: {
      chainId: 1337
    }
  }
};