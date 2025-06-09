// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PublicFundVault
 * @dev A transparent donation and fund distribution platform
 * Supports ETH and ERC-20 token donations, community voting on proposals
 */
contract PublicFundVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // State variables
    uint256 private _proposalIdCounter;
    
    uint256 public totalEthDonations;
    uint256 public constant VOTING_DURATION = 7 days;
    uint256 public constant MIN_PROPOSAL_INTERVAL = 1 days;
    uint256 public constant QUORUM_PERCENTAGE = 51; // 51% majority
    
    // Mappings
    mapping(address => uint256) public ethDonations;
    mapping(address => mapping(address => uint256)) public tokenDonations; // donor => token => amount
    mapping(address => uint256) public totalTokenDonations; // token => total amount
    mapping(address => address[]) public donorTokens; // donor => list of tokens donated
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public votes; // proposalId => voter => vote (true = yes, false = no)
    mapping(address => uint256) public lastProposalTime;
    
    // Structs
    struct Proposal {
        uint256 id;
        string title;
        string description;
        string ipfsHash;
        address payable recipient;
        uint256 ethAmount;
        address tokenAddress;
        uint256 tokenAmount;
        uint256 createdAt;
        uint256 votingEndsAt;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        address proposer;
        bool isActive;
    }
    
    struct TokenInfo {
        address tokenAddress;
        uint256 totalDonated;
        string symbol;
        uint8 decimals;
    }
    
    // Arrays
    address[] public supportedTokens;
    address[] public donors;
    
    // Events
    event EthDonationReceived(address indexed donor, uint256 amount, uint256 timestamp);
    event TokenDonationReceived(address indexed donor, address indexed token, uint256 amount, uint256 timestamp);
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        address recipient,
        uint256 ethAmount,
        address tokenAddress,
        uint256 tokenAmount,
        string ipfsHash
    );
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool vote, uint256 timestamp);
    event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 ethAmount, address tokenAddress, uint256 tokenAmount);
    event TokenAdded(address indexed token, string symbol, uint8 decimals);
    
    // Modifiers
    modifier onlyDonor() {
        require(ethDonations[msg.sender] > 0 || hasTokenDonations(msg.sender), "Only donors can vote");
        _;
    }
    
    modifier validProposal(uint256 _proposalId) {
        require(_proposalId > 0 && _proposalId <= _proposalIdCounter, "Invalid proposal ID");
        require(proposals[_proposalId].isActive, "Proposal is not active");
        _;
    }
    
    modifier votingActive(uint256 _proposalId) {
        require(block.timestamp <= proposals[_proposalId].votingEndsAt, "Voting period has ended");
        _;
    }
    
    modifier votingEnded(uint256 _proposalId) {
        require(block.timestamp > proposals[_proposalId].votingEndsAt, "Voting period is still active");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Receive ETH donations
     */
    receive() external payable {
        donateEth();
    }
    
    /**
     * @dev Donate ETH to the vault
     */
    function donateEth() public payable nonReentrant {
        require(msg.value > 0, "Donation amount must be greater than 0");
        
        if (ethDonations[msg.sender] == 0) {
            donors.push(msg.sender);
        }
        
        ethDonations[msg.sender] += msg.value;
        totalEthDonations += msg.value;
        
        emit EthDonationReceived(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Donate ERC-20 tokens to the vault
     */
    function donateToken(address _token, uint256 _amount) external nonReentrant {
        require(_token != address(0), "Invalid token address");
        require(_amount > 0, "Donation amount must be greater than 0");
        require(isTokenSupported(_token), "Token not supported");
        
        IERC20 token = IERC20(_token);
        require(token.balanceOf(msg.sender) >= _amount, "Insufficient token balance");
        
        if (tokenDonations[msg.sender][_token] == 0) {
            donorTokens[msg.sender].push(_token);
            if (ethDonations[msg.sender] == 0 && !hasTokenDonations(msg.sender)) {
                donors.push(msg.sender);
            }
        }
        
        token.safeTransferFrom(msg.sender, address(this), _amount);
        
        tokenDonations[msg.sender][_token] += _amount;
        totalTokenDonations[_token] += _amount;
        
        emit TokenDonationReceived(msg.sender, _token, _amount, block.timestamp);
    }
    
    /**
     * @dev Add a supported ERC-20 token
     */
    function addSupportedToken(address _token, string memory _symbol, uint8 _decimals) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(!isTokenSupported(_token), "Token already supported");
        
        supportedTokens.push(_token);
        emit TokenAdded(_token, _symbol, _decimals);
    }
    
    /**
     * @dev Create a new funding proposal
     */
    function createProposal(
        string memory _title,
        string memory _description,
        string memory _ipfsHash,
        address payable _recipient,
        uint256 _ethAmount,
        address _tokenAddress,
        uint256 _tokenAmount
    ) external onlyDonor nonReentrant {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_recipient != address(0), "Invalid recipient address");
        require(_ethAmount > 0 || _tokenAmount > 0, "Must request either ETH or tokens");
        require(block.timestamp >= lastProposalTime[msg.sender] + MIN_PROPOSAL_INTERVAL, "Must wait before creating another proposal");
        
        if (_ethAmount > 0) {
            require(_ethAmount <= address(this).balance, "Insufficient ETH in vault");
        }
        
        if (_tokenAmount > 0) {
            require(_tokenAddress != address(0), "Invalid token address for token proposal");
            require(isTokenSupported(_tokenAddress), "Token not supported");
            require(_tokenAmount <= IERC20(_tokenAddress).balanceOf(address(this)), "Insufficient token balance in vault");
        }
        
        _proposalIdCounter++;
        uint256 newProposalId = _proposalIdCounter;
        
        proposals[newProposalId] = Proposal({
            id: newProposalId,
            title: _title,
            description: _description,
            ipfsHash: _ipfsHash,
            recipient: _recipient,
            ethAmount: _ethAmount,
            tokenAddress: _tokenAddress,
            tokenAmount: _tokenAmount,
            createdAt: block.timestamp,
            votingEndsAt: block.timestamp + VOTING_DURATION,
            yesVotes: 0,
            noVotes: 0,
            executed: false,
            proposer: msg.sender,
            isActive: true
        });
        
        lastProposalTime[msg.sender] = block.timestamp;
        
        emit ProposalCreated(
            newProposalId,
            msg.sender,
            _title,
            _recipient,
            _ethAmount,
            _tokenAddress,
            _tokenAmount,
            _ipfsHash
        );
    }
    
    /**
     * @dev Vote on a proposal
     */
    function vote(uint256 _proposalId, bool _vote) external validProposal(_proposalId) votingActive(_proposalId) onlyDonor nonReentrant {
        require(!hasVoted[_proposalId][msg.sender], "Already voted on this proposal");
        
        hasVoted[_proposalId][msg.sender] = true;
        votes[_proposalId][msg.sender] = _vote;
        
        if (_vote) {
            proposals[_proposalId].yesVotes++;
        } else {
            proposals[_proposalId].noVotes++;
        }
        
        emit VoteCast(_proposalId, msg.sender, _vote, block.timestamp);
    }
    
    /**
     * @dev Execute a proposal if it has reached quorum and majority
     */
    function executeProposal(uint256 _proposalId) external validProposal(_proposalId) votingEnded(_proposalId) nonReentrant {
        Proposal storage proposal = proposals[_proposalId];
        require(!proposal.executed, "Proposal already executed");
        
        uint256 totalVotes = proposal.yesVotes + proposal.noVotes;
        uint256 totalDonors = getTotalDonors();
        
        require(totalVotes >= (totalDonors * QUORUM_PERCENTAGE) / 100, "Quorum not reached");
        require(proposal.yesVotes > proposal.noVotes, "Proposal rejected");
        
        proposal.executed = true;
        proposal.isActive = false;
        
        // Transfer ETH if requested
        if (proposal.ethAmount > 0) {
            require(address(this).balance >= proposal.ethAmount, "Insufficient ETH balance");
            proposal.recipient.transfer(proposal.ethAmount);
        }
        
        // Transfer tokens if requested
        if (proposal.tokenAmount > 0) {
            IERC20 token = IERC20(proposal.tokenAddress);
            require(token.balanceOf(address(this)) >= proposal.tokenAmount, "Insufficient token balance");
            token.safeTransfer(proposal.recipient, proposal.tokenAmount);
        }
        
        emit ProposalExecuted(_proposalId, proposal.recipient, proposal.ethAmount, proposal.tokenAddress, proposal.tokenAmount);
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        require(_proposalId > 0 && _proposalId <= _proposalIdCounter, "Invalid proposal ID");
        return proposals[_proposalId];
    }
    
    /**
     * @dev Get all active proposals
     */
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256[] memory activeIds = new uint256[](_proposalIdCounter);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= _proposalIdCounter; i++) {
            if (proposals[i].isActive && block.timestamp <= proposals[i].votingEndsAt) {
                activeIds[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeIds[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get total number of proposals
     */
    function getTotalProposals() external view returns (uint256) {
        return _proposalIdCounter;
    }
    
    /**
     * @dev Get donor's voting power (based on total donations)
     */
    function getVotingPower(address _donor) external view returns (uint256) {
        uint256 ethPower = ethDonations[_donor];
        uint256 tokenPower = 0;
        
        for (uint256 i = 0; i < donorTokens[_donor].length; i++) {
            address token = donorTokens[_donor][i];
            tokenPower += tokenDonations[_donor][token];
        }
        
        return ethPower + tokenPower;
    }
    
    /**
     * @dev Get total number of unique donors
     */
    function getTotalDonors() public view returns (uint256) {
        return donors.length;
    }
    
    /**
     * @dev Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }
    
    /**
     * @dev Get contract ETH balance
     */
    function getEthBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get contract token balance
     */
    function getTokenBalance(address _token) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }
    
    /**
     * @dev Check if donor has made token donations
     */
    function hasTokenDonations(address _donor) public view returns (bool) {
        return donorTokens[_donor].length > 0;
    }
    
    /**
     * @dev Check if token is supported
     */
    function isTokenSupported(address _token) public view returns (bool) {
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == _token) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Get donor's token donation history
     */
    function getDonorTokens(address _donor) external view returns (address[] memory) {
        return donorTokens[_donor];
    }
    
    /**
     * @dev Emergency withdrawal (only owner)
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            // Withdraw ETH
            require(_amount <= address(this).balance, "Insufficient ETH balance");
            payable(owner()).transfer(_amount);
        } else {
            // Withdraw tokens
            IERC20 token = IERC20(_token);
            require(_amount <= token.balanceOf(address(this)), "Insufficient token balance");
            token.safeTransfer(owner(), _amount);
        }
    }
} 