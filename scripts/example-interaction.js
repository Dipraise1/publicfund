const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 PublicFundVault Interaction Example\n");

    // Get signers
    const [owner, donor1, donor2, donor3, recipient] = await ethers.getSigners();
    
    // Contract addresses (updated with deployed addresses)
    const VAULT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // PublicFundVault address
    const TOKEN_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Mock DAI address

    // Get contract instances
    const PublicFundVault = await ethers.getContractFactory("PublicFundVault");
    const vault = PublicFundVault.attach(VAULT_ADDRESS);
    
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = MockERC20.attach(TOKEN_ADDRESS);

    console.log("📋 Contract Information:");
    console.log("Vault Address:", VAULT_ADDRESS);
    console.log("Token Address:", TOKEN_ADDRESS);
    console.log("Owner:", owner.address);
    console.log();

    try {
        // Step 1: Make ETH donations
        console.log("💝 Step 1: Making ETH Donations");
        
        const donation1 = ethers.parseEther("2");
        const donation2 = ethers.parseEther("1.5");
        const donation3 = ethers.parseEther("1");

        console.log("Donor 1 donating 2 ETH...");
        await vault.connect(donor1).donateEth({ value: donation1 });
        
        console.log("Donor 2 donating 1.5 ETH...");
        await vault.connect(donor2).donateEth({ value: donation2 });
        
        console.log("Donor 3 donating 1 ETH...");
        await vault.connect(donor3).donateEth({ value: donation3 });

        // Check vault balance
        const totalEth = await vault.getEthBalance();
        const totalDonors = await vault.getTotalDonors();
        console.log(`✅ Total ETH in vault: ${ethers.formatEther(totalEth)} ETH`);
        console.log(`✅ Total donors: ${totalDonors}`);
        console.log();

        // Step 2: Make token donations
        console.log("🪙 Step 2: Making Token Donations");
        
        // Get tokens from faucet
        console.log("Getting tokens from faucet...");
        await token.connect(donor1).faucet();
        await token.connect(donor2).faucet();
        
        // Approve and donate tokens
        const tokenAmount = ethers.parseEther("500");
        
        console.log("Donor 1 approving and donating 500 tokens...");
        await token.connect(donor1).approve(VAULT_ADDRESS, tokenAmount);
        await vault.connect(donor1).donateToken(TOKEN_ADDRESS, tokenAmount);
        
        console.log("Donor 2 approving and donating 500 tokens...");
        await token.connect(donor2).approve(VAULT_ADDRESS, tokenAmount);
        await vault.connect(donor2).donateToken(TOKEN_ADDRESS, tokenAmount);

        const totalTokens = await vault.getTokenBalance(TOKEN_ADDRESS);
        console.log(`✅ Total tokens in vault: ${ethers.formatEther(totalTokens)}`);
        console.log();

        // Step 3: Create a proposal
        console.log("📝 Step 3: Creating a Proposal");
        
        const proposalTitle = "Community Center Funding";
        const proposalDescription = "Fund the construction of a new community center for local events and activities.";
        const ipfsHash = "QmExampleHash1234567890abcdef"; // Example IPFS hash
        const requestedAmount = ethers.parseEther("2");

        console.log("Creating proposal for 2 ETH to community center...");
        const createTx = await vault.connect(donor1).createProposal(
            proposalTitle,
            proposalDescription,
            ipfsHash,
            recipient.address,
            requestedAmount,
            ethers.ZeroAddress, // No token request
            0
        );
        
        const createReceipt = await createTx.wait();
        const proposalId = 1; // First proposal
        
        console.log(`✅ Proposal created with ID: ${proposalId}`);
        console.log(`   Title: ${proposalTitle}`);
        console.log(`   Recipient: ${recipient.address}`);
        console.log(`   Amount: ${ethers.formatEther(requestedAmount)} ETH`);
        console.log();

        // Step 4: Vote on the proposal
        console.log("🗳️ Step 4: Voting on the Proposal");
        
        console.log("Donor 1 voting YES...");
        await vault.connect(donor1).vote(proposalId, true);
        
        console.log("Donor 2 voting YES...");
        await vault.connect(donor2).vote(proposalId, true);
        
        console.log("Donor 3 voting NO...");
        await vault.connect(donor3).vote(proposalId, false);

        // Check proposal status
        const proposal = await vault.getProposal(proposalId);
        console.log(`✅ Voting completed:`);
        console.log(`   Yes votes: ${proposal.yesVotes}`);
        console.log(`   No votes: ${proposal.noVotes}`);
        console.log(`   Voting ends: ${new Date(Number(proposal.votingEndsAt) * 1000)}`);
        console.log();

        // Step 5: Fast forward time (for demo purposes)
        console.log("⏰ Step 5: Fast Forwarding Time (Demo Only)");
        
        console.log("Fast forwarding 7 days + 1 second...");
        await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]); // 7 days + 1 second
        await ethers.provider.send("evm_mine", []);
        console.log("✅ Time fast-forwarded");
        console.log();

        // Step 6: Execute the proposal
        console.log("⚡ Step 6: Executing the Proposal");
        
        const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address);
        console.log(`Recipient balance before: ${ethers.formatEther(recipientBalanceBefore)} ETH`);
        
        console.log("Executing proposal...");
        await vault.connect(donor1).executeProposal(proposalId);
        
        const recipientBalanceAfter = await ethers.provider.getBalance(recipient.address);
        console.log(`Recipient balance after: ${ethers.formatEther(recipientBalanceAfter)} ETH`);
        
        const difference = recipientBalanceAfter - recipientBalanceBefore;
        console.log(`✅ Proposal executed! Recipient received: ${ethers.formatEther(difference)} ETH`);
        console.log();

        // Step 7: Check final vault status
        console.log("📊 Step 7: Final Vault Status");
        
        const finalEthBalance = await vault.getEthBalance();
        const finalTokenBalance = await vault.getTokenBalance(TOKEN_ADDRESS);
        const totalProposals = await vault.getTotalProposals();
        
        console.log(`Final ETH balance: ${ethers.formatEther(finalEthBalance)} ETH`);
        console.log(`Final token balance: ${ethers.formatEther(finalTokenBalance)}`);
        console.log(`Total proposals created: ${totalProposals}`);
        console.log(`Total donors: ${totalDonors}`);

        // Individual donor contributions
        console.log("\n👥 Individual Donor Contributions:");
        const donor1Eth = await vault.ethDonations(donor1.address);
        const donor2Eth = await vault.ethDonations(donor2.address);
        const donor3Eth = await vault.ethDonations(donor3.address);
        
        console.log(`Donor 1: ${ethers.formatEther(donor1Eth)} ETH`);
        console.log(`Donor 2: ${ethers.formatEther(donor2Eth)} ETH`);
        console.log(`Donor 3: ${ethers.formatEther(donor3Eth)} ETH`);

        console.log("\n🎉 Example interaction completed successfully!");
        console.log("\n📝 Summary of Actions:");
        console.log("✅ Made ETH and token donations from multiple donors");
        console.log("✅ Created a funding proposal with IPFS hash");
        console.log("✅ Conducted democratic voting (2 YES, 1 NO)");
        console.log("✅ Successfully executed proposal after voting period");
        console.log("✅ Transferred 2 ETH to recipient automatically");
        console.log("✅ All activities recorded transparently on-chain");

    } catch (error) {
        console.error("❌ Error during interaction:", error.message);
        console.error("\n💡 Possible solutions:");
        console.error("1. Make sure the contract is deployed to the correct address");
        console.error("2. Ensure you have enough ETH for gas fees");
        console.error("3. Check that the addresses are correct");
        console.error("4. Verify the network configuration");
    }
}

// Run the example
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 