export const TESTNET = {
  chainId: 97,
  explorer: "https://testnet.bscscan.com",
  deployer: "0x36ABB7cC5C3d3b944eC2c88cDB0DFE40f9a4712c",
  vaultFactory: "0x2EF7a93b2fE4FBF520D5210b3ea39a72E5133dc6",
  launcherFactory: "0xE82642aC5c3B3B4b7D4cDeaf6a251Dc0BB7AcEfd",
  agentIdNft: "0x89c60E8E5aF13508900152e5FEE149bf5708d8a0",
  agentIdStandIn: true,
  agentIdSource: "0xe4f7B9aBA67FEDAbF9B9a151C604466D448DAb09",
  erc8004Registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  erc8004Source: "0x0526f00B99e952cE55F1B7BDaf9E6Ae42b42cf22",
  publicLaunch: {
    launcher: "0xEc6410ACea44ac8aaD7f048f68CE45D3c113c59e",
    settlementTx: "0x56d87f21c4dbd55227d9e619986555f150c7da5ddec5db663b201a9b9985ae20",
  },
  saltLockFeeWei: "5000000000000000",
} as const;

export const TESTNET_ROWS: { name: string; address: string; standIn?: boolean }[] = [
  { name: "发射工厂", address: TESTNET.launcherFactory },
  { name: "金库工厂", address: TESTNET.vaultFactory },
  { name: "Agent ID 替身", address: TESTNET.agentIdNft, standIn: true },
  { name: "Agent ID 来源", address: TESTNET.agentIdSource },
  { name: "ERC-8004 来源", address: TESTNET.erc8004Source },
  { name: "ERC-8004 注册表", address: TESTNET.erc8004Registry },
];
