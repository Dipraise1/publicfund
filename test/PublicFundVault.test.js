const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PublicFundVault", function () {
  let publicFundVault;
  let mockToken;
  let owner;
  let donor1;
  let donor2;
  let donor3;
  let recipient;
  let nonDonor;

  const VOTING_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
  const MIN_PROPOSAL_INTERVAL = 24 * 60 * 60; // 1 day in seconds

  beforeEach(async function () {
    [owner, donor1, donor2, donor3, recipient, nonDonor] = await ethers.getSigners();

    // Deploy MockERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Test Token", "TST", 18, 1000000);
    await mockToken.waitForDeployment();

    // Deploy PublicFundVault
    const PublicFundVault = await ethers.getContractFactory("PublicFundVault");
    publicFundVault = await PublicFundVault.deploy();
    await publicFundVault.waitForDeployment();

    // Add mock token as supported
    await publicFundVault.addSupportedToken(await mockToken.getAddress(), "TST", 18);

    // Transfer tokens to donors for testing
    await mockToken.transfer(donor1.address, ethers.parseEther("1000"));
    await mockToken.transfer(donor2.address, ethers.parseEther("1000"));
    await mockToken.transfer(donor3.address, ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should deploy with correct initial values", async function () {
      expect(await publicFundVault.totalEthDonations()).to.equal(0);
      expect(await publicFundVault.getTotalDonors()).to.equal(0);
      expect(await publicFundVault.getTotalProposals()).to.equal(0);
    });

    it("Should have correct owner", async function () {
      expect(await publicFundVault.owner()).to.equal(owner.address);
    });
  });

  describe("ETH Donations", function () {
    it("Should accept ETH donations", async function () {
      const donationAmount = ethers.parseEther("1");
      
      await expect(publicFundVault.connect(donor1).donateEth({ value: donationAmount }))
        .to.emit(publicFundVault, "EthDonationReceived");

      expect(await publicFundVault.ethDonations(donor1.address)).to.equal(donationAmount);
      expect(await publicFundVault.totalEthDonations()).to.equal(donationAmount);
      expect(await publicFundVault.getTotalDonors()).to.equal(1);
    });

    it("Should accept ETH via receive function", async function () {
      const donationAmount = ethers.parseEther("0.5");
      
      await donor1.sendTransaction({
        to: await publicFundVault.getAddress(),
        value: donationAmount
      });

      expect(await publicFundVault.ethDonations(donor1.address)).to.equal(donationAmount);
    });

    it("Should track multiple donations from same donor", async function () {
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("0.5");
      
      await publicFundVault.connect(donor1).donateEth({ value: amount1 });
      await publicFundVault.connect(donor1).donateEth({ value: amount2 });

      expect(await publicFundVault.ethDonations(donor1.address)).to.equal(amount1 + amount2);
      expect(await publicFundVault.getTotalDonors()).to.equal(1); // Should not duplicate donor
    });

    it("Should reject zero ETH donations", async function () {
      await expect(publicFundVault.connect(donor1).donateEth({ value: 0 }))
        .to.be.revertedWith("Donation amount must be greater than 0");
    });
  });

  describe("Token Donations", function () {
    it("Should accept token donations", async function () {
      const donationAmount = ethers.parseEther("100");
      
      // Approve tokens first
      await mockToken.connect(donor1).approve(await publicFundVault.getAddress(), donationAmount);
      
      await expect(publicFundVault.connect(donor1).donateToken(await mockToken.getAddress(), donationAmount))
        .to.emit(publicFundVault, "TokenDonationReceived");

      expect(await publicFundVault.tokenDonations(donor1.address, await mockToken.getAddress())).to.equal(donationAmount);
      expect(await publicFundVault.totalTokenDonations(await mockToken.getAddress())).to.equal(donationAmount);
    });

    it("Should reject unsupported token donations", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const unsupportedToken = await MockERC20.deploy("Unsupported", "UNS", 18, 1000);
      await unsupportedToken.waitForDeployment();
      
      const donationAmount = ethers.parseEther("100");
      await unsupportedToken.approve(await publicFundVault.getAddress(), donationAmount);

      await expect(publicFundVault.connect(donor1).donateToken(await unsupportedToken.getAddress(), donationAmount))
        .to.be.revertedWith("Token not supported");
    });

    it("Should reject zero token donations", async function () {
      await expect(publicFundVault.connect(donor1).donateToken(await mockToken.getAddress(), 0))
        .to.be.revertedWith("Donation amount must be greater than 0");
    });
  });

  describe("Proposal Creation", function () {
    beforeEach(async function () {
      // Make donations so users can create proposals
      await publicFundVault.connect(donor1).donateEth({ value: ethers.parseEther("2") });
      await mockToken.connect(donor2).approve(await publicFundVault.getAddress(), ethers.parseEther("500"));
      await publicFundVault.connect(donor2).donateToken(await mockToken.getAddress(), ethers.parseEther("500"));
    });

    it("Should create ETH proposal", async function () {
      const title = "Community Center Funding";
      const description = "Fund a new community center";
      const ipfsHash = "QmTestHash123";
      const ethAmount = ethers.parseEther("1");

      await expect(publicFundVault.connect(donor1).createProposal(
        title,
        description,
        ipfsHash,
        recipient.address,
        ethAmount,
        ethers.ZeroAddress,
        0
      )).to.emit(publicFundVault, "ProposalCreated");

      const proposal = await publicFundVault.getProposal(1);
      expect(proposal.title).to.equal(title);
      expect(proposal.description).to.equal(description);
      expect(proposal.ipfsHash).to.equal(ipfsHash);
      expect(proposal.recipient).to.equal(recipient.address);
      expect(proposal.ethAmount).to.equal(ethAmount);
      expect(proposal.isActive).to.be.true;
    });

    it("Should create token proposal", async function () {
      const title = "Token Grant";
      const description = "Grant tokens for development";
      const ipfsHash = "QmTokenHash456";
      const tokenAmount = ethers.parseEther("100");

      await expect(publicFundVault.connect(donor2).createProposal(
        title,
        description,
        ipfsHash,
        recipient.address,
        0,
        await mockToken.getAddress(),
        tokenAmount
      )).to.emit(publicFundVault, "ProposalCreated");

      const proposal = await publicFundVault.getProposal(1);
      expect(proposal.tokenAddress).to.equal(await mockToken.getAddress());
      expect(proposal.tokenAmount).to.equal(tokenAmount);
    });

    it("Should reject proposals from non-donors", async function () {
      await expect(publicFundVault.connect(nonDonor).createProposal(
        "Test",
        "Test Description",
        "QmTest",
        recipient.address,
        ethers.parseEther("1"),
        ethers.ZeroAddress,
        0
      )).to.be.revertedWith("Only donors can vote");
    });

    it("Should reject proposals with empty title", async function () {
      await expect(publicFundVault.connect(donor1).createProposal(
        "",
        "Test Description",
        "QmTest",
        recipient.address,
        ethers.parseEther("1"),
        ethers.ZeroAddress,
        0
      )).to.be.revertedWith("Title cannot be empty");
    });

    it("Should enforce proposal interval", async function () {
      await publicFundVault.connect(donor1).createProposal(
        "First Proposal",
        "Description",
        "QmTest1",
        recipient.address,
        ethers.parseEther("1"),
        ethers.ZeroAddress,
        0
      );

      await expect(publicFundVault.connect(donor1).createProposal(
        "Second Proposal",
        "Description",
        "QmTest2",
        recipient.address,
        ethers.parseEther("1"),
        ethers.ZeroAddress,
        0
      )).to.be.revertedWith("Must wait before creating another proposal");
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      // Make donations
      await publicFundVault.connect(donor1).donateEth({ value: ethers.parseEther("1") });
      await publicFundVault.connect(donor2).donateEth({ value: ethers.parseEther("1") });
      await publicFundVault.connect(donor3).donateEth({ value: ethers.parseEther("1") });

      // Create a proposal
      await publicFundVault.connect(donor1).createProposal(
        "Test Proposal",
        "Test Description",
        "QmTest",
        recipient.address,
        ethers.parseEther("2"),
        ethers.ZeroAddress,
        0
      );
    });

    it("Should allow donors to vote", async function () {
      await expect(publicFundVault.connect(donor1).vote(1, true))
        .to.emit(publicFundVault, "VoteCast");

      const proposal = await publicFundVault.getProposal(1);
      expect(proposal.yesVotes).to.equal(1);
      expect(proposal.noVotes).to.equal(0);
    });

    it("Should prevent double voting", async function () {
      await publicFundVault.connect(donor1).vote(1, true);
      
      await expect(publicFundVault.connect(donor1).vote(1, false))
        .to.be.revertedWith("Already voted on this proposal");
    });

    it("Should reject votes from non-donors", async function () {
      await expect(publicFundVault.connect(nonDonor).vote(1, true))
        .to.be.revertedWith("Only donors can vote");
    });

    it("Should reject votes after voting period ends", async function () {
      // Fast forward past voting period
      await time.increase(VOTING_DURATION + 1);
      
      await expect(publicFundVault.connect(donor1).vote(1, true))
        .to.be.revertedWith("Voting period has ended");
    });
  });

  describe("Proposal Execution", function () {
    beforeEach(async function () {
      // Make donations
      await publicFundVault.connect(donor1).donateEth({ value: ethers.parseEther("5") });
      await publicFundVault.connect(donor2).donateEth({ value: ethers.parseEther("1") });

      // Create and vote on proposal
      await publicFundVault.connect(donor1).createProposal(
        "Test Proposal",
        "Test Description", 
        "QmTest",
        recipient.address,
        ethers.parseEther("2"),
        ethers.ZeroAddress,
        0
      );

      // Vote yes with majority
      await publicFundVault.connect(donor1).vote(1, true);
      await publicFundVault.connect(donor2).vote(1, true);

      // Fast forward past voting period
      await time.increase(VOTING_DURATION + 1);
    });

    it("Should execute proposal with majority and quorum", async function () {
      const initialBalance = await ethers.provider.getBalance(recipient.address);
      
      await expect(publicFundVault.executeProposal(1))
        .to.emit(publicFundVault, "ProposalExecuted");

      const finalBalance = await ethers.provider.getBalance(recipient.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("2"));

      const proposal = await publicFundVault.getProposal(1);
      expect(proposal.executed).to.be.true;
      expect(proposal.isActive).to.be.false;
    });

    it("Should reject execution before voting ends", async function () {
      // Create a new proposal to test timing
      await publicFundVault.connect(donor1).createProposal(
        "Test Timing",
        "Test Description", 
        "QmTest",
        recipient.address,
        ethers.parseEther("1"),
        ethers.ZeroAddress,
        0
      );
      
      await expect(publicFundVault.executeProposal(2))
        .to.be.revertedWith("Voting period is still active");
    });

    it("Should reject execution without quorum", async function () {
      // Add more donors first to increase quorum requirement
      const donor4 = (await ethers.getSigners())[6];
      const donor5 = (await ethers.getSigners())[7];
      await publicFundVault.connect(donor4).donateEth({ value: ethers.parseEther("1") });
      await publicFundVault.connect(donor5).donateEth({ value: ethers.parseEther("1") });

      // Create a new proposal after adding donors
      await time.increase(MIN_PROPOSAL_INTERVAL + 1);
      await publicFundVault.connect(donor1).createProposal(
        "Quorum Test",
        "Test Description", 
        "QmTest",
        recipient.address,
        ethers.parseEther("1"),
        ethers.ZeroAddress,
        0
      );

      // Only one vote out of 5 donors (20% < 51% quorum)
      await publicFundVault.connect(donor1).vote(2, true);
      
      await time.increase(VOTING_DURATION + 1);
      
      await expect(publicFundVault.executeProposal(2))
        .to.be.revertedWith("Quorum not reached");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await publicFundVault.connect(donor1).donateEth({ value: ethers.parseEther("1") });
      await mockToken.connect(donor2).approve(await publicFundVault.getAddress(), ethers.parseEther("100"));
      await publicFundVault.connect(donor2).donateToken(await mockToken.getAddress(), ethers.parseEther("100"));
    });

    it("Should return correct balances", async function () {
      expect(await publicFundVault.getEthBalance()).to.equal(ethers.parseEther("1"));
      expect(await publicFundVault.getTokenBalance(await mockToken.getAddress())).to.equal(ethers.parseEther("100"));
    });

    it("Should return voting power", async function () {
      const votingPower = await publicFundVault.getVotingPower(donor2.address);
      expect(votingPower).to.equal(ethers.parseEther("100"));
    });

    it("Should return supported tokens", async function () {
      const supportedTokens = await publicFundVault.getSupportedTokens();
      expect(supportedTokens).to.include(await mockToken.getAddress());
    });

    it("Should return donor tokens", async function () {
      const donorTokens = await publicFundVault.getDonorTokens(donor2.address);
      expect(donorTokens).to.include(await mockToken.getAddress());
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async function () {
      await publicFundVault.connect(donor1).donateEth({ value: ethers.parseEther("1") });
    });

    it("Should allow owner to emergency withdraw ETH", async function () {
      const amount = ethers.parseEther("0.5");
      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      await publicFundVault.emergencyWithdraw(ethers.ZeroAddress, amount);
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should reject emergency withdrawal from non-owner", async function () {
      await expect(publicFundVault.connect(donor1).emergencyWithdraw(ethers.ZeroAddress, ethers.parseEther("0.5")))
        .to.be.revertedWithCustomError(publicFundVault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Gas Optimization", function () {
    it("Should be gas efficient for donations", async function () {
      const tx = await publicFundVault.connect(donor1).donateEth({ value: ethers.parseEther("1") });
      const receipt = await tx.wait();
      
      // ETH donation should be under 150k gas (adjusted for IR compilation)
      expect(receipt.gasUsed).to.be.lt(150000);
    });
  });
}); 