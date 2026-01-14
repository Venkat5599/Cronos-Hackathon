import { ethers } from "hardhat";

const CONTRACTS = {
  policyEngine: '0xb1385C18FC4326420fFb41C299Cb2C8a4802B5c2',
  router: '0x2ffE191B2086551BA80DabfFC77652BED4a179ee',
};

async function main() {
  console.log("Verifying deployed contracts on Cronos Testnet...\n");

  const provider = ethers.provider;

  // Check if contracts have code
  const policyCode = await provider.getCode(CONTRACTS.policyEngine);
  const routerCode = await provider.getCode(CONTRACTS.router);

  console.log("PolicyEngine at:", CONTRACTS.policyEngine);
  console.log("  Has code:", policyCode !== "0x" ? "YES ✓" : "NO ✗");
  console.log("  Code length:", policyCode.length);

  console.log("\nRouter at:", CONTRACTS.router);
  console.log("  Has code:", routerCode !== "0x" ? "YES ✓" : "NO ✗");
  console.log("  Code length:", routerCode.length);

  if (policyCode === "0x" || routerCode === "0x") {
    console.log("\n⚠️  One or more contracts not found. Need to redeploy!");
    return false;
  }

  // Try to call view functions
  console.log("\nTesting contract calls...");
  
  const PolicyEngine = await ethers.getContractFactory("X402PolicyEngine");
  const policyEngine = PolicyEngine.attach(CONTRACTS.policyEngine);

  try {
    const maxPayment = await policyEngine.globalMaxPayment();
    console.log("  globalMaxPayment:", ethers.formatEther(maxPayment), "CRO");
    
    const dailyLimit = await policyEngine.globalDailyLimit();
    console.log("  globalDailyLimit:", ethers.formatEther(dailyLimit), "CRO");
    
    const owner = await policyEngine.owner();
    console.log("  owner:", owner);
  } catch (err) {
    console.log("  Error calling PolicyEngine:", err);
  }

  const Router = await ethers.getContractFactory("X402ExecutionRouter");
  const router = Router.attach(CONTRACTS.router);

  try {
    const stats = await router.getStats();
    console.log("\n  Router stats:");
    console.log("    totalPayments:", stats[0].toString());
    console.log("    totalVolume:", ethers.formatEther(stats[1]), "CRO");
    console.log("    totalBlocked:", stats[2].toString());
  } catch (err) {
    console.log("  Error calling Router:", err);
  }

  return true;
}

main()
  .then((success) => {
    if (!success) {
      console.log("\nRun: npx hardhat run scripts/deploy.ts --network cronos-testnet");
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
