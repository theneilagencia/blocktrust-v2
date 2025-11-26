import hre from "hardhat";
import fs from "fs";

async function main() {
  console.log("🚀 Iniciando deploy dos contratos Blocktrust v1.2...\n");

  // Deploy IdentityNFT
  console.log("📜 Deploying IdentityNFT...");
  const IdentityNFT = await hre.ethers.deployContract("IdentityNFT");
  await IdentityNFT.waitForDeployment();
  const identityAddress = await IdentityNFT.getAddress();
  console.log(`✅ IdentityNFT deployed to: ${identityAddress}`);

  // Deploy ProofRegistry
  console.log("\n📜 Deploying ProofRegistry...");
  const ProofRegistry = await hre.ethers.deployContract("ProofRegistry");
  await ProofRegistry.waitForDeployment();
  const proofAddress = await ProofRegistry.getAddress();
  console.log(`✅ ProofRegistry deployed to: ${proofAddress}`);

  // Deploy FailSafe
  console.log("\n📜 Deploying FailSafe...");
  const FailSafe = await hre.ethers.deployContract("FailSafe", [identityAddress]);
  await FailSafe.waitForDeployment();
  const failsafeAddress = await FailSafe.getAddress();
  console.log(`✅ FailSafe deployed to: ${failsafeAddress}`);

  // Salvar configuração
  const config = {
    IdentityNFT: {
      address: identityAddress,
      abi: JSON.parse(IdentityNFT.interface.formatJson())
    },
    ProofRegistry: {
      address: proofAddress,
      abi: JSON.parse(ProofRegistry.interface.formatJson())
    },
    FailSafe: {
      address: failsafeAddress,
      abi: JSON.parse(FailSafe.interface.formatJson())
    }
  };

  fs.writeFileSync("contracts_config.json", JSON.stringify(config, null, 2));
  console.log("\n💾 Configuração salva em contracts_config.json");

  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOY CONCLUÍDO COM SUCESSO!");
  console.log("=".repeat(60));
  console.log("\n📋 ENDEREÇOS DOS CONTRATOS:");
  console.log(`  IdentityNFT:   ${identityAddress}`);
  console.log(`  ProofRegistry: ${proofAddress}`);
  console.log(`  FailSafe:      ${failsafeAddress}`);
  console.log("\n🔗 LINKS (PolygonScan Mumbai):");
  console.log(`  IdentityNFT:   https://mumbai.polygonscan.com/address/${identityAddress}`);
  console.log(`  ProofRegistry: https://mumbai.polygonscan.com/address/${proofAddress}`);
  console.log(`  FailSafe:      https://mumbai.polygonscan.com/address/${failsafeAddress}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
