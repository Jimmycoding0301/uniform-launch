import { cpSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [destinationArg, factory, runtimeCodeHash] = process.argv.slice(2);
const portal = '0x000042108465206185A077Edc3F3fd2b49060000';
const oldFactory = '0xe82642ac5c3b3b4b7d4cdeaf6a251dc0bb7acefd';
const source = fileURLToPath(new URL('./uniform-launch/', import.meta.url));
if (!destinationArg || process.argv.length !== 5 || !/^0x[0-9a-fA-F]{40}$/.test(factory) ||
    /^0x0{40}$/.test(factory) || [portal.toLowerCase(), oldFactory].includes(factory.toLowerCase()) ||
    !/^0x[0-9a-fA-F]{64}$/.test(runtimeCodeHash) || /^0x0{64}$/.test(runtimeCodeHash)) {
  throw new Error('Usage: node prepare.mjs <new output directory> <reviewed chain-97 factory> <deployed runtime bytecode keccak256>');
}
const destination = resolve(destinationArg);
if (existsSync(destination)) throw new Error('Choose a new directory to avoid replacing existing source.');
const staging = mkdtempSync(join(dirname(destination), '.' + basename(destination) + '-'));
try {
  cpSync(source, staging, { recursive: true });
  const manifestFile = join(staging, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  manifest.walletChains = [97];
  manifest.walletContracts = [
    { id: 'portal', chainId: 97, address: portal, maxValueWei: '5000000000000000',
      allow: ['function newLauncher(address launcherFactory,bytes data) payable returns (address launcher)'],
      read: ['function SALT_LOCK_FEE() view returns (uint256)'] },
    { id: 'uniform-factory', chainId: 97, address: factory.toLowerCase(), codeHash: runtimeCodeHash.toLowerCase(),
      read: ['function agentIdSource() view returns (address)', 'function erc8004Source() view returns (address)'],
      resolvedContracts: [{ id: 'uniform-auction', resolver: 'function resolveLauncher(address candidate) view returns (address)',
        maxValueWei: '100000000000000000000',
        allow: ['function bid(uint256 maxPrice,uint8 sourceIndex,uint256 agentId) payable','function settle()','function claim()','function refund()'],
        read: ['function statusCode() view returns (uint8)','function identitySourceCount() view returns (uint256)','function identitySources(uint256 index) view returns (address)','function floorPrice() view returns (uint256)','function endBlock() view returns (uint64)'] }] }
  ];
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2)+'\n');
  const componentFile = join(staging, 'Component.tsx');
  const sourceText = readFileSync(componentFile, 'utf8');
  const unbound = 'const CERTIFIED_FACTORY: Address = zeroAddress;';
  if (!sourceText.includes(unbound)) throw new Error('Unbound source factory marker missing.');
  writeFileSync(componentFile, sourceText.replace(unbound, 'const CERTIFIED_FACTORY = "' + factory.toLowerCase() + '" as const;'));
  renameSync(staging, destination);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
