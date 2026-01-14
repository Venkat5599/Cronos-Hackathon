import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    "cronos-testnet": {
      url: process.env.CRONOS_TESTNET_RPC || "https://evm-t3.cronos.org",
      chainId: 338,
      accounts: [PRIVATE_KEY],
    },
    "cronos-mainnet": {
      url: process.env.CRONOS_MAINNET_RPC || "https://evm.cronos.org",
      chainId: 25,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      "cronos-testnet": "U5k1wkNBMejEA6Wf0Fs2yaGwuwlUKno7",
      "cronos-mainnet": "U5k1wkNBMejEA6Wf0Fs2yaGwuwlUKno7",
    },
    customChains: [
      {
        network: "cronos-testnet",
        chainId: 338,
        urls: {
          apiURL: "https://cronos.org/explorer/testnet3/api",
          browserURL: "https://cronos.org/explorer/testnet3",
        },
      },
      {
        network: "cronos-mainnet",
        chainId: 25,
        urls: {
          apiURL: "https://cronos.org/explorer/api",
          browserURL: "https://cronos.org/explorer",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
