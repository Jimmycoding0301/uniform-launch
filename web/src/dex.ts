export const PANCAKE_V2_ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
export const PANCAKE_V2_FACTORY = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
export const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

export function poolLink(pool: string): string {
  return `https://testnet.bscscan.com/address/${pool}#code`;
}

export function pancakeSwapLink(token: string): string {
  return `https://pancakeswap.finance/swap?chain=bscTestnet&outputCurrency=${token}&inputCurrency=${WBNB}&via=${PANCAKE_V2_ROUTER}&factory=${PANCAKE_V2_FACTORY}`;
}
