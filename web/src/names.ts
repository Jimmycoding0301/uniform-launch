const NAMES: Record<string, string> = {
  "0x00000000000000000000000000000000c0de0002": "nova.ai",
  "0x00000000000000000000000000000000c0de0003": "kiln.ai",
  "0x00000000000000000000000000000000c0de0004": "mica.ai",
  "0x00000000000000000000000000000000c0de0005": "reed.ai",
  "0x00000000000000000000000000000000c0de0006": "sable.ai",
  "0x00000000000000000000000000000000c0de0007": "wren.ai",
  "0x00000000000000000000000000000000c0de0008": "lumen.ai",
  "0x00000000000000000000000000000000c0de0009": "quay.ai",
  "0x00000000000000000000000000000000c0de000a": "orbit.ai",
  "0x00000000000000000000000000000000c0de000b": "nacre.ai",
};

export function agentName(address: string): string {
  return agentLabel(address).text;
}

export function agentLabel(address: string): { text: string; named: boolean } {
  const name = NAMES[address.toLowerCase()];
  if (name) return { text: name, named: true };
  return { text: `${address.slice(0, 6)}…${address.slice(-4)}`, named: false };
}
