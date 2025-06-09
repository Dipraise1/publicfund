const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Starting PublicFundVault deployment...\n");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Deploy MockERC20 tokens for testing (only on local/test networks)
    const networkName = await ethers.provider.getNetwork();
    const isLocalNetwork = networkName.chainId === 1337n || networkName.chainId === 31337n;
    
    let mockTokens = [];
    if (isLocalNetwork) {
        console.log("🪙 Deploying mock ERC-20 tokens for local testing...");
        
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        
        // Deploy USDC mock
        const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6, 1000000);
        await mockUSDC.waitForDeployment();
        console.log("   ✅ Mock USDC deployed to:", await mockUSDC.getAddress());
        
        // Deploy DAI mock
        const mockDAI = await MockERC20.deploy("Mock DAI", "DAI", 18, 1000000);
        await mockDAI.waitForDeployment();
        console.log("   ✅ Mock DAI deployed to:", await mockDAI.getAddress());
        
        mockTokens = [
            { name: "Mock USDC", symbol: "USDC", address: await mockUSDC.getAddress(), decimals: 6 },
            { name: "Mock DAI", symbol: "DAI", address: await mockDAI.getAddress(), decimals: 18 }
        ];
    }

    // Deploy PublicFundVault
    console.log("\n🏛️ Deploying PublicFundVault...");
    const PublicFundVault = await ethers.getContractFactory("PublicFundVault");
    const publicFundVault = await PublicFundVault.deploy();
    await publicFundVault.waitForDeployment();
    
    const vaultAddress = await publicFundVault.getAddress();
    console.log("   ✅ PublicFundVault deployed to:", vaultAddress);

    // Add mock tokens as supported (only on local networks)
    if (isLocalNetwork && mockTokens.length > 0) {
        console.log("\n🔧 Adding supported tokens...");
        for (const token of mockTokens) {
            await publicFundVault.addSupportedToken(token.address, token.symbol, token.decimals);
            console.log(`   ✅ Added ${token.symbol} (${token.address}) as supported token`);
        }
    }

    // Verification info
    console.log("\n📋 Deployment Summary:");
    console.log("========================");
    console.log("Network:", networkName.name, `(Chain ID: ${networkName.chainId})`);
    console.log("PublicFundVault:", vaultAddress);
    
    if (mockTokens.length > 0) {
        console.log("\nMock Tokens:");
        mockTokens.forEach(token => {
            console.log(`${token.symbol}: ${token.address}`);
        });
    }

    console.log("\n🎯 Contract Features:");
    console.log("- ✅ ETH donations (send ETH directly to contract)");
    console.log("- ✅ ERC-20 token donations");
    console.log("- ✅ Community proposal creation");
    console.log("- ✅ Democratic voting (51% majority + quorum)");
    console.log("- ✅ Automatic fund distribution");
    console.log("- ✅ IPFS hash support for proposals");
    console.log("- ✅ 7-day voting windows");
    console.log("- ✅ Anti-spam measures (1-day proposal interval)");
    console.log("- ✅ Transparent on-chain records");

    if (isLocalNetwork) {
        console.log("\n🧪 Testing Instructions:");
        console.log("1. Get mock tokens from faucet: mockToken.faucet()");
        console.log("2. Approve tokens: mockToken.approve(vaultAddress, amount)");
        console.log("3. Donate tokens: vault.donateToken(tokenAddress, amount)");
        console.log("4. Donate ETH: vault.donateEth({value: amount})");
        console.log("5. Create proposal: vault.createProposal(...)");
        console.log("6. Vote on proposals: vault.vote(proposalId, true/false)");
        console.log("7. Execute proposals after voting period");
    }

    console.log("\n🎉 Deployment completed successfully!");

    // Save deployment info to file
    const deploymentInfo = {
        network: networkName.name,
        chainId: networkName.chainId.toString(),
        publicFundVault: vaultAddress,
        mockTokens: mockTokens,
        deployer: deployer.address,
        deploymentTime: new Date().toISOString(),
        features: [
            "ETH donations",
            "ERC-20 token donations", 
            "Community proposals",
            "Democratic voting",
            "IPFS integration",
            "Time-based voting windows",
            "Anti-spam protection"
        ]
    };

    const fs = require('fs');
    const path = require('path');
    
    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }
    
    // Write deployment info
    fs.writeFileSync(
        path.join(deploymentsDir, `${networkName.name}-${networkName.chainId}.json`),
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log(`💾 Deployment info saved to deployments/${networkName.name}-${networkName.chainId}.json`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 