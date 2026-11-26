#!/usr/bin/env bash
# Usage: bash script/package-review.sh OUTPUT.zip [COMMIT]
# Maintainers need an initialized checkout (git submodule update --init).
# Reviewers can unzip the result and run forge test, then verify SHA256SUMS.
set -euo pipefail
if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo 'Usage: bash script/package-review.sh OUTPUT.zip [COMMIT]' >&2
  exit 2
fi
repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
python3 - "$repo" "$1" "${2:-HEAD}" <<'PY'
import datetime
import hashlib
import io
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import zipfile

repo = Path(sys.argv[1])
destination = Path(sys.argv[2]).absolute()
if destination.suffix.lower() != ".zip" or destination.exists():
    sys.exit("Choose a new output path ending in .zip")

def git(directory, *arguments):
    return subprocess.check_output(["git", "-C", directory, *arguments])

commit = git(repo, "rev-parse", "--verify", "--end-of-options", sys.argv[3] + "^{commit}").decode().strip()
epoch = int(git(repo, "show", "-s", "--format=%ct", commit))
timestamp = datetime.datetime.fromtimestamp(epoch, datetime.timezone.utc).timetuple()[:6]
project_paths = [
    "README.md", "LICENSE", ".gitmodules", "foundry.lock", "foundry.toml", "remappings.txt",
    "docker-compose.yml", "src", "test", "script", "shared", "deployments", "flap-ui", "web",
    "agent", "docs", "qa/submission", "qa/r15",
]
# These are the complete compile-time source trees used by remappings.txt.
# The dependency projects' own tests, build outputs and development tools are unnecessary.
vendor_paths = {
    "lib/forge-std": ["src", "LICENSE-APACHE", "LICENSE-MIT"],
    "lib/openzeppelin-contracts": ["contracts", "LICENSE"],
    "lib/openzeppelin-contracts-upgradeable": ["contracts", "LICENSE"],
    "lib/solady": ["src", "LICENSE.txt"],
}
excluded = [
    "**/.env*", "**/node_modules/**", "**/.git/**", "**/secrets/**", "**/.secrets/**",
    "**/keystore/**", "**/keystores/**", "**/.ssh/**", "**/credentials/**", "**/signers/**",
    "**/cache/**", "**/broadcast/**", "**/out/**", "**/dist/**",
    "**/*.pem", "**/*.p12", "**/*.pfx", "**/*.key", "**/*.jks", "**/*.keystore",
    "**/id_rsa*", "**/id_ed25519*", "**/credentials.json", "**/secrets.json",
    "**/signer.json", "**/signers.json", "**/UTC--*", "**/private-key*", "**/private_key*",
    "**/mnemonic*", "**/wallet.json", "**/api-key*", "**/api_key*",
]
exclusions = [":(exclude,glob,icase)" + pattern for pattern in excluded]
files = {}

def collect(directory, revision, paths, prefix=""):
    archive = git(directory, "archive", "--format=tar", revision, "--", *paths, *exclusions)
    with tarfile.open(fileobj=io.BytesIO(archive)) as stream:
        for member in stream:
            if member.isdir():
                continue
            if not member.isfile():
                sys.exit("Review source contains an unsupported link or special file: " + member.name)
            files[prefix + member.name] = (stream.extractfile(member).read(), member.mode)

collect(repo, commit, project_paths)
pins = []
for path, include in vendor_paths.items():
    entry = git(repo, "ls-tree", commit, "--", path).decode().split()
    if len(entry) != 4 or entry[:2] != ["160000", "commit"]:
        sys.exit("Expected a pinned submodule at " + path)
    pin = entry[2]
    directory = repo / path
    if not (directory / ".git").exists():
        sys.exit("Initialize dependency sources first: git submodule update --init")
    collect(directory, pin, include, path + "/")
    pins.append(f"{pin}  {path}")

required = [
    "shared/vectors.json", "script/LocalRpc.sol", "script/package-review.sh",
    "flap-ui/launcher-detail/Component.tsx", "flap-ui/launcher-detail/i18n.json",
    "flap-ui/launcher-detail/manifest.json", "flap-ui/mini-app/uniform-launch/manifest.json",
    "flap-ui/mini-app/uniform-launch/Component.tsx", "flap-ui/mini-app/uniform-launch/i18n.json",
    "flap-ui/mini-app/uniform-launch/VaultABI.ts", "flap-ui/mini-app/prepare.mjs",
    "agent/package-lock.json", "web/package-lock.json",
]
missing = [path for path in required if path not in files]
if missing:
    sys.exit("Missing required review sources in commit " + commit + ": " + ", ".join(missing))

provenance = f"Project commit  {commit}\n\nVendored Solidity dependency commits\n" + "\n".join(pins) + "\n"
files["REVIEW-COMMIT.txt"] = (provenance.encode(), 0o644)
checksums = "".join(f"{hashlib.sha256(files[name][0]).hexdigest()}  {name}\n" for name in sorted(files))
files["SHA256SUMS"] = (checksums.encode(), 0o644)
destination.parent.mkdir(parents=True, exist_ok=True)
with tempfile.NamedTemporaryFile(dir=destination.parent) as temp:
    with zipfile.ZipFile(temp, "w") as archive:
        for name in sorted(files):
            data, mode = files[name]
            info = zipfile.ZipInfo(name, timestamp)
            info.create_system = 3
            info.external_attr = (0o100755 if mode & 0o111 else 0o100644) << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    temp.flush()
    os.link(temp.name, destination)
digest = hashlib.sha256(destination.read_bytes()).hexdigest()
print(f"Project commit  {commit}\nSHA-256  {digest}  {destination}")
PY
