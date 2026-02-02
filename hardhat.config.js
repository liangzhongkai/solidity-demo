require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
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