# PublicFundVault

A transparent, democratic platform for community fund management built on Ethereum.

## Features

- 🔗 Transparent ETH and ERC-20 token donations
- 🗳️ Democratic proposal creation and voting system
- ⚡ Automatic execution of approved proposals
- 🔒 Smart contract security with OpenZeppelin standards
- 📱 Mobile-responsive React frontend
- 🌐 Web3 integration with MetaMask

## Tech Stack

- **Smart Contracts**: Solidity, Hardhat, OpenZeppelin
- **Frontend**: React, Ethers.js, CSS3
- **Testing**: Hardhat Test Suite
- **Deployment**: Ethereum testnet/mainnet ready

## Project Structure

```
├── contracts/           # Smart contracts
├── scripts/            # Deployment scripts
├── test/               # Test files
├── frontend/           # React application
└── hardhat.config.js   # Hardhat configuration
```

## Getting Started

### Prerequisites
- Node.js v16+ and npm
- MetaMask wallet extension

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Dipraise1/publicfund.git
   cd publicfund
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install
   cd ..
   ```

3. **Start local blockchain**
   ```bash
   npx hardhat node
   ```

4. **Deploy contracts** (in a new terminal)
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

5. **Start frontend** (in a new terminal)
   ```bash
   cd frontend
   npm start
   ```

6. **Connect MetaMask**
   - Add localhost network (Chain ID: 31337, RPC: http://localhost:8545)
   - Import test accounts from Hardhat node

## Smart Contract Architecture

### PublicFundVault.sol
Main contract handling:
- ETH and ERC-20 donations
- Proposal creation and management
- Democratic voting system (51% majority + quorum)
- Automatic execution of approved proposals
- Transparent fund tracking

### Key Features
- **Time-limited Voting**: 7-day voting periods
- **Anti-spam Protection**: 1-day interval between proposals
- **Security**: ReentrancyGuard, access controls
- **Transparency**: All transactions on-chain
- **IPFS Integration**: Store proposal documents

## Testing

Run comprehensive test suite:
```bash
npx hardhat test
```

Tests cover:
- Contract deployment
- Donation functionality
- Proposal lifecycle
- Voting mechanisms
- Execution logic
- Security scenarios

## Deployment

### Local Development
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### Testnet Deployment
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### Mainnet Deployment
```bash
npx hardhat run scripts/deploy.js --network mainnet
```

## Frontend Features

- **Dashboard**: Real-time vault statistics
- **Donations**: Easy ETH donation interface
- **Proposals**: Browse and vote on community proposals
- **Create**: Submit new funding proposals
- **History**: Complete transaction tracking
- **Mobile Responsive**: Optimized for all devices

## Security

- OpenZeppelin contracts for battle-tested security
- ReentrancyGuard protection
- Access control mechanisms
- Comprehensive test coverage
- Transparent on-chain operations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License

## Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ for transparent community funding** 