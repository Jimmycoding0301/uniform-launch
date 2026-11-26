import { parseAbi } from "viem";

export const PortalABI = parseAbi([
  "function SALT_LOCK_FEE() view returns (uint256)",
  "function newLauncher(address launcherFactory,bytes data) payable returns (address launcher)",
]);

export const FactoryABI = parseAbi([
  "function agentIdSource() view returns (address)",
  "function erc8004Source() view returns (address)",
  "function resolveLauncher(address candidate) view returns (address)",
  "event UniformLauncherCreated(address indexed launcher,address indexed creator,bytes32 salt)",
]);

export const VaultABI = parseAbi([
  "function statusCode() view returns (uint8)",
  "function identitySourceCount() view returns (uint256)",
  "function identitySources(uint256 index) view returns (address)",
  "function floorPrice() view returns (uint256)",
  "function endBlock() view returns (uint64)",
  "function bid(uint256 maxPrice,uint8 sourceIndex,uint256 agentId) payable",
  "function settle()",
  "function claim()",
  "function refund()",
]);
