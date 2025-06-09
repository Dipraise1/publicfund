import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { formatDistanceToNow, format } from 'date-fns';
import './App.css';

// Contract ABI
const CONTRACT_ABI = [
  "function donateEth() external payable",
  "function donateToken(address _token, uint256 _amount) external",
  "function createProposal(string memory _title, string memory _description, string memory _ipfsHash, address payable _recipient, uint256 _ethAmount, address _tokenAddress, uint256 _tokenAmount) external",
  "function vote(uint256 _proposalId, bool _vote) external", 
  "function executeProposal(uint256 _proposalId) external",
  "function getProposal(uint256 _proposalId) external view returns (tuple(uint256 id, string title, string description, string ipfsHash, address recipient, uint256 ethAmount, address tokenAddress, uint256 tokenAmount, uint256 createdAt, uint256 votingEndsAt, uint256 yesVotes, uint256 noVotes, bool executed, address proposer, bool isActive))",
  "function getActiveProposals() external view returns (uint256[] memory)",
  "function getTotalProposals() external view returns (uint256)",
  "function getTotalDonors() external view returns (uint256)",
  "function getEthBalance() external view returns (uint256)",
  "function ethDonations(address) external view returns (uint256)",
  "function totalEthDonations() external view returns (uint256)",
  "function getSupportedTokens() external view returns (address[] memory)",
  "function getVotingPower(address donor) external view returns (uint256)",
  "event EthDonationReceived(address indexed donor, uint256 amount, uint256 timestamp)",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, address recipient, uint256 ethAmount, address tokenAddress, uint256 tokenAmount, string ipfsHash)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool vote, uint256 timestamp)",
  "event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 ethAmount, address tokenAddress, uint256 tokenAmount)"
];

// Notification Component
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`notification ${type}`}>
      <div className="notification-content">
        <span className="notification-icon">
          {type === 'success' ? 
            <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Success" style={{ width: '18px', height: '18px' }} /> : 
            type === 'error' ? 
            <img src="https://cdn-icons-png.flaticon.com/512/1828/1828843.png" alt="Error" style={{ width: '18px', height: '18px' }} /> : 
            <img src="https://cdn-icons-png.flaticon.com/512/157/157933.png" alt="Info" style={{ width: '18px', height: '18px' }} />}
        </span>
        <span className="notification-message">{message}</span>
        <button className="notification-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="spinner">
    <div className="spinner-ring"></div>
  </div>
);

// Statistics Card Component
const StatCard = ({ title, value, icon, description }) => (
  <div className="stat-card">
    <div className="stat-header">
      <div className="stat-icon">{icon}</div>
      <h3 className="stat-title">{title}</h3>
    </div>
    <div className="stat-value">{value}</div>
    {description && <div className="stat-description">{description}</div>}
  </div>
);

// Proposal Card Component
const ProposalCard = ({ proposal, onVote, onExecute, loading, userAddress }) => {
  const isVotingActive = () => {
    const now = Math.floor(Date.now() / 1000);
    return proposal.isActive && now <= Number(proposal.votingEndsAt);
  };

  const canExecute = () => {
    const now = Math.floor(Date.now() / 1000);
    return proposal.isActive && !proposal.executed && now > Number(proposal.votingEndsAt);
  };

  const getTimeRemaining = () => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = Number(proposal.votingEndsAt) - now;
    if (timeLeft <= 0) return "Voting ended";
    
    const endDate = new Date(Number(proposal.votingEndsAt) * 1000);
    return `${formatDistanceToNow(endDate)} remaining`;
  };

  const getVotePercentage = () => {
    const total = Number(proposal.yesVotes) + Number(proposal.noVotes);
    if (total === 0) return { yes: 0, no: 0 };
    return {
      yes: Math.round((Number(proposal.yesVotes) / total) * 100),
      no: Math.round((Number(proposal.noVotes) / total) * 100)
    };
  };

  const percentages = getVotePercentage();

  return (
    <div className="proposal-card">
      <div className="proposal-header">
        <h3 className="proposal-title">{proposal.title}</h3>
        <div className={`proposal-status ${proposal.executed ? 'executed' : isVotingActive() ? 'active' : 'ended'}`}>
          {proposal.executed ? 'Executed' : isVotingActive() ? 'Active' : 'Voting Ended'}
        </div>
      </div>
      
      <p className="proposal-description">{proposal.description}</p>
      
      <div className="proposal-details">
        <div className="detail-row">
          <span className="detail-label">Recipient:</span>
          <span className="detail-value address">{proposal.recipient}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Amount:</span>
          <span className="detail-value">{ethers.formatEther(proposal.ethAmount)} ETH</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Proposer:</span>
          <span className="detail-value address">{proposal.proposer}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Created:</span>
          <span className="detail-value">
            {format(new Date(Number(proposal.createdAt) * 1000), 'MMM dd, yyyy')}
          </span>
        </div>
        {proposal.ipfsHash && (
          <div className="detail-row">
            <span className="detail-label">IPFS:</span>
            <a 
              href={`https://ipfs.io/ipfs/${proposal.ipfsHash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ipfs-link"
            >
              View Details
            </a>
          </div>
        )}
      </div>

      <div className="voting-section">
        <div className="vote-counts">
          <div className="vote-item yes">
            <span className="vote-label">Yes</span>
            <span className="vote-count">{proposal.yesVotes.toString()}</span>
            <span className="vote-percentage">({percentages.yes}%)</span>
          </div>
          <div className="vote-item no">
            <span className="vote-label">No</span>
            <span className="vote-count">{proposal.noVotes.toString()}</span>
            <span className="vote-percentage">({percentages.no}%)</span>
          </div>
        </div>
        
        <div className="vote-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill yes" 
              style={{ width: `${percentages.yes}%` }}
            ></div>
            <div 
              className="progress-fill no" 
              style={{ width: `${percentages.no}%` }}
            ></div>
          </div>
        </div>

        <div className="time-remaining">
          {getTimeRemaining()}
        </div>
      </div>
      
      <div className="proposal-actions">
        {isVotingActive() && (
          <>
                         <button 
               className="btn btn-success"
               onClick={() => onVote(proposal.id, true)} 
               disabled={loading}
             >
               {loading ? <LoadingSpinner /> : (
                 <>
                   <img src="https://cdn-icons-png.flaticon.com/512/126/126473.png" alt="Thumbs up" style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                   Vote Yes
                 </>
               )}
             </button>
             <button 
               className="btn btn-danger"
               onClick={() => onVote(proposal.id, false)} 
               disabled={loading}
             >
               {loading ? <LoadingSpinner /> : (
                 <>
                   <img src="https://cdn-icons-png.flaticon.com/512/126/126504.png" alt="Thumbs down" style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                   Vote No
                 </>
               )}
             </button>
          </>
        )}
        {canExecute() && (
                     <button 
             className="btn btn-primary"
             onClick={() => onExecute(proposal.id)} 
             disabled={loading}
           >
             {loading ? <LoadingSpinner /> : (
               <>
                 <img src="https://cdn-icons-png.flaticon.com/512/2797/2797387.png" alt="Execute" style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                 Execute Proposal
               </>
             )}
           </button>
        )}
                 {proposal.executed && (
           <div className="executed-badge">
             <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Success" style={{ width: '16px', height: '16px', marginRight: '6px' }} />
             Successfully Executed
           </div>
         )}
      </div>
    </div>
  );
};

function App() {
  // State management
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [vaultStats, setVaultStats] = useState({
    totalEth: '0',
    totalDonors: '0',
    totalProposals: '0'
  });
  const [userStats, setUserStats] = useState({
    donation: '0',
    votingPower: '0'
  });
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [networkInfo, setNetworkInfo] = useState({ name: '', chainId: null });
  
  // Form states
  const [donationAmount, setDonationAmount] = useState('');
  const [proposalForm, setProposalForm] = useState({
    title: '',
    description: '',
    ipfsHash: '',
    recipient: '',
    ethAmount: ''
  });

  // Contract address
  const CONTRACT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  // Use ref for notification counter to ensure unique keys
  const notificationCounter = useRef(0);

  // Notification system
  const addNotification = useCallback((message, type = 'info') => {
    notificationCounter.current += 1;
    const id = `notification_${notificationCounter.current}_${Date.now()}`;
    setNotifications(prev => [...prev, { id, message, type }]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  // Check if contract is deployed
  const checkContractDeployment = useCallback(async (contractInstance) => {
    try {
      const provider = contractInstance.runner;
      const contractCode = await provider.getCode(CONTRACT_ADDRESS);
      return contractCode !== '0x';
    } catch (error) {
      console.error('Error checking contract deployment:', error);
      return false;
    }
  }, []);

  // Add transaction to history
  const addTransaction = useCallback((tx, type, description) => {
    const transaction = {
      hash: tx.hash,
      type,
      description,
      timestamp: Date.now(),
      status: 'pending'
    };
    setTransactionHistory(prev => [transaction, ...prev]);
    
    // Update transaction status when confirmed
    tx.wait().then(() => {
      setTransactionHistory(prev => 
        prev.map(t => 
          t.hash === tx.hash 
            ? { ...t, status: 'confirmed' }
            : t
        )
      );
    }).catch(() => {
      setTransactionHistory(prev => 
        prev.map(t => 
          t.hash === tx.hash 
            ? { ...t, status: 'failed' }
            : t
        )
      );
    });
  }, []);

  // Load vault data
  const loadVaultData = useCallback(async (contractInstance, userAddress) => {
    if (!contractInstance || !userAddress) {
      console.warn('Contract instance or user address not available');
      return;
    }

    try {
      // Validate contract is deployed by checking if it has code
      const provider = contractInstance.runner;
      const contractCode = await provider.getCode(CONTRACT_ADDRESS);
      
      if (contractCode === '0x') {
        throw new Error('Contract not deployed at the specified address');
      }

      const [totalEth, totalDonors, totalProposals, userDonation, userVotingPower] = await Promise.all([
        contractInstance.getEthBalance(),
        contractInstance.getTotalDonors(),
        contractInstance.getTotalProposals(),
        contractInstance.ethDonations(userAddress),
        contractInstance.getVotingPower(userAddress)
      ]);
      
      setVaultStats({
        totalEth: ethers.formatEther(totalEth),
        totalDonors: totalDonors.toString(),
        totalProposals: totalProposals.toString()
      });
      
      setUserStats({
        donation: ethers.formatEther(userDonation),
        votingPower: ethers.formatEther(userVotingPower)
      });
    } catch (error) {
      console.error('Error loading vault data:', error);
      if (error.message.includes('Contract not deployed')) {
        addNotification('Contract not found. Please ensure the local blockchain is running and the contract is deployed.', 'error');
      } else {
        addNotification('Failed to load vault data. Please check your connection.', 'error');
      }
    }
  }, [addNotification]);

  // Load proposals
  const loadProposals = useCallback(async (contractInstance) => {
    if (!contractInstance) {
      console.warn('Contract instance not available');
      return;
    }

    try {
      // Validate contract is deployed
      const provider = contractInstance.runner;
      const contractCode = await provider.getCode(CONTRACT_ADDRESS);
      
      if (contractCode === '0x') {
        throw new Error('Contract not deployed at the specified address');
      }

      const totalProposals = await contractInstance.getTotalProposals();
      const totalProposalsNum = Number(totalProposals);
      
      if (totalProposalsNum === 0) {
        setProposals([]);
        return;
      }
      
      const proposalPromises = [];
      for (let i = 1; i <= totalProposalsNum; i++) {
        proposalPromises.push(contractInstance.getProposal(i));
      }
      
      const proposalResults = await Promise.all(proposalPromises);
      setProposals(proposalResults.reverse()); // Show newest first
    } catch (error) {
      console.error('Error loading proposals:', error);
      if (error.message.includes('Contract not deployed')) {
        addNotification('Contract not found. Please ensure the local blockchain is running and the contract is deployed.', 'error');
      } else {
        addNotification('Failed to load proposals. Please check your connection.', 'error');
      }
    }
  }, [addNotification]);

  // Initialize the application
  const initializeApp = useCallback(async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        
        // Get network info
        const network = await provider.getNetwork();
        setNetworkInfo({ 
          name: network.name === 'unknown' ? 'Localhost' : network.name, 
          chainId: Number(network.chainId) 
        });
        
        const accounts = await provider.send('eth_requestAccounts', []);
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const signer = await provider.getSigner();
          
          const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
          setContract(contract);
          setIsConnected(true);
          
          await loadVaultData(contract, accounts[0]);
          await loadProposals(contract);
          
          addNotification('Successfully connected to PublicFundVault!', 'success');
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        if (error.message.includes('User rejected')) {
          addNotification('Connection rejected by user', 'error');
        } else {
          addNotification('Failed to connect to the application. Please ensure MetaMask is unlocked and the correct network is selected.', 'error');
        }
      }
    } else {
      addNotification('Please install MetaMask to use this application', 'error');
    }
  }, [addNotification, loadVaultData, loadProposals]);

  // Donate ETH
  const donateEth = async () => {
    if (!contract || !donationAmount || parseFloat(donationAmount) <= 0) {
      addNotification('Please enter a valid donation amount', 'error');
      return;
    }

    if (parseFloat(donationAmount) < 0.001) {
      addNotification('Minimum donation amount is 0.001 ETH', 'error');
      return;
    }

    // Check if contract is deployed
    const isDeployed = await checkContractDeployment(contract);
    if (!isDeployed) {
      addNotification('Contract not found. Please ensure the local blockchain is running and the contract is deployed.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const tx = await contract.donateEth({
        value: ethers.parseEther(donationAmount)
      });
      
      addTransaction(tx, 'donation', `Donated ${donationAmount} ETH`);
      addNotification('Transaction submitted. Please wait for confirmation...', 'info');
      await tx.wait();
      
      setDonationAmount('');
      await loadVaultData(contract, account);
      addNotification(`Successfully donated ${donationAmount} ETH!`, 'success');
    } catch (error) {
      console.error('Error donating ETH:', error);
      if (error.message.includes('insufficient funds')) {
        addNotification('Insufficient funds. Please check your balance.', 'error');
      } else if (error.message.includes('User denied')) {
        addNotification('Transaction rejected by user.', 'error');
      } else {
        addNotification('Donation failed. Please check your balance and try again.', 'error');
      }
    }
    setLoading(false);
  };

  // Create proposal
  const createProposal = async () => {
    if (!contract || !proposalForm.title || !proposalForm.recipient || !proposalForm.ethAmount) {
      addNotification('Please fill in all required fields', 'error');
      return;
    }
    
    if (parseFloat(proposalForm.ethAmount) <= 0) {
      addNotification('Please enter a valid ETH amount', 'error');
      return;
    }

    // Check if contract is deployed
    const isDeployed = await checkContractDeployment(contract);
    if (!isDeployed) {
      addNotification('Contract not found. Please ensure the local blockchain is running and the contract is deployed.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const tx = await contract.createProposal(
        proposalForm.title,
        proposalForm.description,
        proposalForm.ipfsHash,
        proposalForm.recipient,
        ethers.parseEther(proposalForm.ethAmount),
        ethers.ZeroAddress,
        0
      );
      
      addTransaction(tx, 'proposal', `Created proposal: ${proposalForm.title}`);
      addNotification('Proposal submission in progress...', 'info');
      await tx.wait();
      
      setProposalForm({
        title: '',
        description: '',
        ipfsHash: '',
        recipient: '',
        ethAmount: ''
      });
      
      await loadProposals(contract);
      await loadVaultData(contract, account);
      addNotification('Proposal created successfully!', 'success');
      setActiveTab('proposals');
    } catch (error) {
      console.error('Error creating proposal:', error);
      if (error.message.includes('insufficient donation')) {
        addNotification('You must make a donation before creating proposals.', 'error');
      } else if (error.message.includes('proposal interval')) {
        addNotification('Please wait 24 hours between proposal submissions.', 'error');
      } else if (error.message.includes('User denied')) {
        addNotification('Transaction rejected by user.', 'error');
      } else {
        addNotification('Failed to create proposal. Please check your inputs and try again.', 'error');
      }
    }
    setLoading(false);
  };

  // Vote on proposal
  const voteOnProposal = async (proposalId, vote) => {
    if (!contract) {
      addNotification('Contract not connected. Please refresh and try again.', 'error');
      return;
    }

    // Check if contract is deployed
    const isDeployed = await checkContractDeployment(contract);
    if (!isDeployed) {
      addNotification('Contract not found. Please ensure the local blockchain is running and the contract is deployed.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const tx = await contract.vote(proposalId, vote);
      addTransaction(tx, 'vote', `Voted ${vote ? 'YES' : 'NO'} on proposal #${proposalId}`);
      addNotification('Vote submission in progress...', 'info');
      await tx.wait();
      
      await loadProposals(contract);
      addNotification(`Vote ${vote ? 'YES' : 'NO'} cast successfully!`, 'success');
    } catch (error) {
      console.error('Error voting:', error);
      if (error.message.includes('already voted')) {
        addNotification('You have already voted on this proposal.', 'error');
      } else if (error.message.includes('User denied')) {
        addNotification('Transaction rejected by user.', 'error');
      } else {
        addNotification('Voting failed. Please check if the voting period is still active.', 'error');
      }
    }
    setLoading(false);
  };

  // Execute proposal
  const executeProposal = async (proposalId) => {
    if (!contract) {
      addNotification('Contract not connected. Please refresh and try again.', 'error');
      return;
    }

    // Check if contract is deployed
    const isDeployed = await checkContractDeployment(contract);
    if (!isDeployed) {
      addNotification('Contract not found. Please ensure the local blockchain is running and the contract is deployed.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const tx = await contract.executeProposal(proposalId);
      addTransaction(tx, 'execution', `Executed proposal #${proposalId}`);
      addNotification('Proposal execution in progress...', 'info');
      await tx.wait();
      
      await loadProposals(contract);
      await loadVaultData(contract, account);
      addNotification('Proposal executed successfully!', 'success');
    } catch (error) {
      console.error('Error executing proposal:', error);
      if (error.message.includes('Voting still active')) {
        addNotification('Cannot execute: Voting period is still active.', 'error');
      } else if (error.message.includes('Proposal failed')) {
        addNotification('Proposal failed to meet the required majority for execution.', 'error');
      } else if (error.message.includes('User denied')) {
        addNotification('Transaction rejected by user.', 'error');
      } else {
        addNotification('Execution failed. The proposal may not have met the required conditions.', 'error');
      }
    }
    setLoading(false);
  };

  // Connect wallet
  const connectWallet = async () => {
    await initializeApp();
  };

  useEffect(() => {
    if (window.ethereum) {
      // Check if already connected
      window.ethereum.request({ method: 'eth_accounts' })
        .then(accounts => {
          if (accounts.length > 0) {
            initializeApp();
          }
        })
        .catch(error => {
          console.error('Error checking wallet connection:', error);
        });
    }
  }, [initializeApp]);

  // Format address for display
  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="app">
      {/* Notifications */}
      <div className="notifications-container">
        {notifications.map(notification => (
          <Notification 
            key={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>

      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="brand">
            <h1>
              <img 
                src="https://cdn-icons-png.flaticon.com/512/1078/1078745.png" 
                alt="Vault" 
                style={{ width: '32px', height: '32px', marginRight: '12px', verticalAlign: 'middle' }}
              />
              PublicFundVault
            </h1>
            <p>Transparent Community Fund Management</p>
          </div>
          
          {isConnected ? (
            <div className="user-info">
              <div className="user-stats">
                <span className="user-stat">
                  <strong>Connected:</strong> {formatAddress(account)}
                </span>
                <span className="user-stat">
                  <strong>Your Donations:</strong> {userStats.donation} ETH
                </span>
                <span className="user-stat">
                  <strong>Voting Power:</strong> {userStats.votingPower}
                </span>
                <span className="user-stat">
                  <strong>Network:</strong> {networkInfo.name} ({networkInfo.chainId})
                </span>
              </div>
              <div className="connection-status connected">
                <span className="status-dot"></span>
                Connected
              </div>
            </div>
          ) : (
            <button className="btn btn-primary connect-wallet" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {isConnected ? (
        <>
          {/* Navigation */}
          <nav className="navigation">
            <div className="nav-container">
                             <button 
                 className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                 onClick={() => setActiveTab('dashboard')}
               >
                 <img 
                   src="https://cdn-icons-png.flaticon.com/512/2920/2920277.png" 
                   alt="Dashboard" 
                   style={{ width: '16px', height: '16px', marginRight: '8px' }}
                 />
                 Dashboard
               </button>
                             <button 
                 className={`nav-item ${activeTab === 'donate' ? 'active' : ''}`}
                 onClick={() => setActiveTab('donate')}
               >
                 <img 
                   src="https://cdn-icons-png.flaticon.com/512/1570/1570887.png" 
                   alt="Donate" 
                   style={{ width: '16px', height: '16px', marginRight: '8px' }}
                 />
                 Donate
               </button>
                             <button 
                 className={`nav-item ${activeTab === 'proposals' ? 'active' : ''}`}
                 onClick={() => setActiveTab('proposals')}
               >
                 <img 
                   src="https://cdn-icons-png.flaticon.com/512/3258/3258446.png" 
                   alt="Proposals" 
                   style={{ width: '16px', height: '16px', marginRight: '8px' }}
                 />
                 Proposals
               </button>
                             <button 
                 className={`nav-item ${activeTab === 'create' ? 'active' : ''}`}
                 onClick={() => setActiveTab('create')}
               >
                 <img 
                   src="https://cdn-icons-png.flaticon.com/512/1159/1159633.png" 
                   alt="Create" 
                   style={{ width: '16px', height: '16px', marginRight: '8px' }}
                 />
                 Create Proposal
               </button>
               <button 
                 className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
                 onClick={() => setActiveTab('history')}
               >
                 <img 
                   src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" 
                   alt="History" 
                   style={{ width: '16px', height: '16px', marginRight: '8px' }}
                 />
                 Transaction History
               </button>
            </div>
          </nav>

          {/* Main Content */}
          <main className="main-content">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="dashboard">
                <h2 className="section-title">Vault Overview</h2>
                <div className="stats-grid">
                                     <StatCard 
                     title="Total ETH"
                     value={`${vaultStats.totalEth} ETH`}
                     icon={<img src="https://cdn-icons-png.flaticon.com/512/825/825454.png" alt="Money" style={{ width: '32px', height: '32px' }} />}
                     description="Total funds in the vault"
                   />
                                     <StatCard 
                     title="Community Members"
                     value={vaultStats.totalDonors}
                     icon={<img src="https://cdn-icons-png.flaticon.com/512/1077/1077114.png" alt="Users" style={{ width: '32px', height: '32px' }} />}
                     description="Unique donors participating"
                   />
                                     <StatCard 
                     title="Proposals"
                     value={vaultStats.totalProposals}
                     icon={<img src="https://cdn-icons-png.flaticon.com/512/2921/2921222.png" alt="Documents" style={{ width: '32px', height: '32px' }} />}
                     description="Total proposals created"
                   />
                                     <StatCard 
                     title="Your Contribution"
                     value={`${userStats.donation} ETH`}
                     icon={<img src="https://cdn-icons-png.flaticon.com/512/1570/1570887.png" alt="Target" style={{ width: '32px', height: '32px' }} />}
                     description="Your total donations"
                   />
                </div>
                
                <div className="recent-activity">
                  <h3>Recent Proposals</h3>
                  <div className="proposals-preview">
                    {proposals.slice(0, 3).map((proposal, index) => (
                      <ProposalCard 
                        key={index}
                        proposal={proposal}
                        onVote={voteOnProposal}
                        onExecute={executeProposal}
                        loading={loading}
                        userAddress={account}
                      />
                    ))}
                    {proposals.length === 0 && (
                      <div className="empty-state">
                        <p>No proposals yet. Be the first to create one!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Donate Tab */}
            {activeTab === 'donate' && (
              <div className="donate-section">
                <h2 className="section-title">Make a Donation</h2>
                <div className="donate-card">
                  <div className="donate-info">
                    <h3>Support Community Initiatives</h3>
                    <p>Your donations help fund community projects and initiatives. All funds are managed transparently through democratic voting.</p>
                  </div>
                  
                  <div className="donate-form">
                                         <div className="form-group">
                       <label htmlFor="donation-amount">
                         ETH Amount
                         <span className="help-text">Minimum donation: 0.001 ETH</span>
                       </label>
                       <div className="input-group">
                         <input
                           id="donation-amount"
                           type="number"
                           step="0.001"
                           min="0.001"
                           value={donationAmount}
                           onChange={(e) => setDonationAmount(e.target.value)}
                           placeholder="0.1"
                           className="form-input"
                         />
                         <span className="input-suffix">ETH</span>
                       </div>
                     </div>
                    
                                         <button 
                       className="btn btn-primary btn-large"
                       onClick={donateEth} 
                       disabled={loading || !donationAmount}
                     >
                       {loading ? <LoadingSpinner /> : (
                         <>
                           <img src="https://cdn-icons-png.flaticon.com/512/1570/1570887.png" alt="Donate" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                           Donate Now
                         </>
                       )}
                     </button>
                  </div>
                </div>
              </div>
            )}

            {/* Proposals Tab */}
            {activeTab === 'proposals' && (
              <div className="proposals-section">
                <h2 className="section-title">Community Proposals</h2>
                <div className="proposals-grid">
                  {proposals.map((proposal, index) => (
                    <ProposalCard 
                      key={index}
                      proposal={proposal}
                      onVote={voteOnProposal}
                      onExecute={executeProposal}
                      loading={loading}
                      userAddress={account}
                    />
                  ))}
                  {proposals.length === 0 && (
                    <div className="empty-state">
                      <h3>No Proposals Yet</h3>
                      <p>Be the first to create a proposal for the community!</p>
                      <button 
                        className="btn btn-primary"
                        onClick={() => setActiveTab('create')}
                      >
                        Create First Proposal
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

                         {/* Transaction History Tab */}
             {activeTab === 'history' && (
               <div className="history-section">
                 <h2 className="section-title">Transaction History</h2>
                 <div className="history-container">
                   {transactionHistory.length > 0 ? (
                     <div className="transaction-list">
                       {transactionHistory.map((tx, index) => (
                         <div key={index} className="transaction-item">
                           <div className="transaction-header">
                             <div className="transaction-info">
                               <span className={`transaction-type ${tx.type}`}>
                                 {tx.type === 'donation' ? 
                                   <img src="https://cdn-icons-png.flaticon.com/512/1570/1570887.png" alt="Donation" style={{ width: '12px', height: '12px', marginRight: '4px' }} /> : 
                                  tx.type === 'proposal' ? 
                                   <img src="https://cdn-icons-png.flaticon.com/512/1159/1159633.png" alt="Proposal" style={{ width: '12px', height: '12px', marginRight: '4px' }} /> : 
                                  tx.type === 'vote' ? 
                                   <img src="https://cdn-icons-png.flaticon.com/512/3258/3258446.png" alt="Vote" style={{ width: '12px', height: '12px', marginRight: '4px' }} /> : 
                                   <img src="https://cdn-icons-png.flaticon.com/512/2797/2797387.png" alt="Execute" style={{ width: '12px', height: '12px', marginRight: '4px' }} />}
                                 {tx.type.toUpperCase()}
                               </span>
                               <span className={`transaction-status ${tx.status}`}>
                                 {tx.status === 'pending' ? 
                                   <img src="https://cdn-icons-png.flaticon.com/512/2919/2919592.png" alt="Pending" style={{ width: '12px', height: '12px', marginRight: '4px' }} /> : 
                                  tx.status === 'confirmed' ? 
                                   <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Confirmed" style={{ width: '12px', height: '12px', marginRight: '4px' }} /> : 
                                   <img src="https://cdn-icons-png.flaticon.com/512/1828/1828843.png" alt="Failed" style={{ width: '12px', height: '12px', marginRight: '4px' }} />}
                                 {tx.status.toUpperCase()}
                               </span>
                             </div>
                             <div className="transaction-time">
                               {format(new Date(tx.timestamp), 'MMM dd, yyyy HH:mm')}
                             </div>
                           </div>
                           <div className="transaction-description">{tx.description}</div>
                           <div className="transaction-hash">
                             <span>Hash: </span>
                             <a 
                               href={`https://etherscan.io/tx/${tx.hash}`} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="hash-link"
                             >
                               {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                             </a>
                           </div>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="empty-state">
                       <h3>No Transactions Yet</h3>
                       <p>Your transaction history will appear here once you start interacting with the vault.</p>
                     </div>
                   )}
                 </div>
               </div>
             )}

             {/* Create Proposal Tab */}
             {activeTab === 'create' && (
              <div className="create-section">
                <h2 className="section-title">Create New Proposal</h2>
                <div className="create-card">
                                     <div className="create-info">
                     <h3>Propose a Community Initiative</h3>
                     <p>Submit a proposal for funding. The community will vote on whether to approve your request.</p>
                                           <div className="info-banner">
                        <span className="info-icon">
                          <img src="https://cdn-icons-png.flaticon.com/512/157/157933.png" alt="Info" style={{ width: '20px', height: '20px' }} />
                        </span>
                       <div>
                         <strong>Proposal Requirements:</strong>
                         <ul>
                           <li>Voting lasts for 7 days</li>
                           <li>Requires 51% majority to pass</li>
                           <li>Only donors can vote (voting power = donation amount)</li>
                           <li>Proposals execute automatically if approved</li>
                         </ul>
                       </div>
                     </div>
                   </div>
                  
                  <div className="proposal-form">
                    <div className="form-group">
                      <label htmlFor="proposal-title">Proposal Title *</label>
                      <input
                        id="proposal-title"
                        type="text"
                        value={proposalForm.title}
                        onChange={(e) => setProposalForm({...proposalForm, title: e.target.value})}
                        placeholder="e.g., Community Garden Funding"
                        className="form-input"
                        maxLength={100}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="proposal-description">Description *</label>
                      <textarea
                        id="proposal-description"
                        value={proposalForm.description}
                        onChange={(e) => setProposalForm({...proposalForm, description: e.target.value})}
                        placeholder="Provide a detailed description of your proposal..."
                        className="form-textarea"
                        rows={4}
                        maxLength={1000}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="ipfs-hash">IPFS Hash (Optional)</label>
                      <input
                        id="ipfs-hash"
                        type="text"
                        value={proposalForm.ipfsHash}
                        onChange={(e) => setProposalForm({...proposalForm, ipfsHash: e.target.value})}
                        placeholder="QmHash... (for additional documents)"
                        className="form-input"
                      />
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="recipient-address">Recipient Address *</label>
                        <input
                          id="recipient-address"
                          type="text"
                          value={proposalForm.recipient}
                          onChange={(e) => setProposalForm({...proposalForm, recipient: e.target.value})}
                          placeholder="0x..."
                          className="form-input"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="eth-amount">ETH Amount *</label>
                        <div className="input-group">
                          <input
                            id="eth-amount"
                            type="number"
                            step="0.001"
                            min="0"
                            value={proposalForm.ethAmount}
                            onChange={(e) => setProposalForm({...proposalForm, ethAmount: e.target.value})}
                            placeholder="1.0"
                            className="form-input"
                          />
                          <span className="input-suffix">ETH</span>
                        </div>
                      </div>
                    </div>
                    
                                         <button 
                       className="btn btn-primary btn-large"
                       onClick={createProposal} 
                       disabled={loading || !proposalForm.title || !proposalForm.recipient || !proposalForm.ethAmount}
                     >
                       {loading ? <LoadingSpinner /> : (
                         <>
                           <img src="https://cdn-icons-png.flaticon.com/512/1159/1159633.png" alt="Submit" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                           Submit Proposal
                         </>
                       )}
                     </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      ) : (
        <div className="welcome-screen">
          <div className="welcome-content">
            <h2>Welcome to PublicFundVault</h2>
            <p>A transparent, democratic platform for community fund management</p>
            
                         <div className="features-grid">
               <div className="feature-card">
                 <div className="feature-icon">
                   <img src="https://cdn-icons-png.flaticon.com/512/825/825454.png" alt="Money" style={{ width: '48px', height: '48px' }} />
                 </div>
                 <h3>Transparent Donations</h3>
                 <p>All donations and fund distributions are recorded on the blockchain</p>
               </div>
               <div className="feature-card">
                 <div className="feature-icon">
                   <img src="https://cdn-icons-png.flaticon.com/512/3258/3258446.png" alt="Voting" style={{ width: '48px', height: '48px' }} />
                 </div>
                 <h3>Democratic Voting</h3>
                 <p>Community members vote on how funds should be distributed</p>
               </div>
               <div className="feature-card">
                 <div className="feature-icon">
                   <img src="https://cdn-icons-png.flaticon.com/512/2797/2797387.png" alt="Automation" style={{ width: '48px', height: '48px' }} />
                 </div>
                 <h3>Automatic Execution</h3>
                 <p>Approved proposals are executed automatically without intermediaries</p>
               </div>
               <div className="feature-card">
                 <div className="feature-icon">
                   <img src="https://cdn-icons-png.flaticon.com/512/2092/2092063.png" alt="Security" style={{ width: '48px', height: '48px' }} />
                 </div>
                 <h3>Secure & Trustless</h3>
                 <p>Smart contracts ensure security and eliminate the need for trust</p>
               </div>
             </div>
            
            <button className="btn btn-primary btn-large" onClick={connectWallet}>
              Connect Wallet to Get Started
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-info">
            <p>Built with ❤️ for transparent community funding</p>
            <p>Contract: {formatAddress(CONTRACT_ADDRESS)}</p>
          </div>
          <div className="footer-links">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://docs.openzeppelin.com" target="_blank" rel="noopener noreferrer">Documentation</a>
            <a href="https://etherscan.io" target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App; 