import { t } from "./locale";
export const TESTNET = {
  chainId: 97,
  explorer: "https://testnet.bscscan.com",
  deployer: "0x36ABB7cC5C3d3b944eC2c88cDB0DFE40f9a4712c",
  launcherFactory: "0x5A995C7ee958a631FDD151C9582604d347D7799A",
  agentIdNft: "0x89c60E8E5aF13508900152e5FEE149bf5708d8a0",
  agentIdStandIn: true,
  agentIdSource: "0x5aBdA470ed6A8dad942F6ff125b172c4274A7d32",
  erc8004Registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  erc8004Source: "0x55fa503668E5c32A8FB49aBcF3FD1CCCA0e6AF2D",
  publicLaunch: {
    launcher: "0xADD4e8b95B194D457611b4754e53c45A6E2A41d6",
    createTx: "0x45c339b0d4a62da600714bd411f1d7ab966b51907a5b61379f2b09e4b362bb41",
    bidTx: "0xad339052f8b9e34197476bfd1defffd126373c7b87af77fd74ad0a5a5e4b8ed9",
    settlementTx: "0x5cc2056b689db1a422e5dfbdbd7017a23f86fa9a764effaa6cc82c9c1051ec02",
    claimTx: "0x5e1f06bfce8e6ee3dd379c82593ad35330639f169d22fd189493ec7f42f6bbd9",
  },
  saltLockFeeWei: "5000000000000000",
} as const;

export const TESTNET_ROWS: { name: string; address: string; standIn?: boolean }[] = [
  { name: t("发射工厂", "Launcher factory"), address: TESTNET.launcherFactory },
  { name: t("Agent ID 替身", "Agent ID stand-in"), address: TESTNET.agentIdNft, standIn: true },
  { name: t("Agent ID 来源", "Agent ID source"), address: TESTNET.agentIdSource },
  { name: t("ERC-8004 来源", "ERC-8004 source"), address: TESTNET.erc8004Source },
  { name: t("ERC-8004 注册表", "ERC-8004 registry"), address: TESTNET.erc8004Registry },
];
