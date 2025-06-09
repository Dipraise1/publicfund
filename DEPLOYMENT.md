# PublicFundVault Deployment Guide

## Vercel Deployment

### Prerequisites
1. GitHub repository with the latest code
2. Vercel account connected to GitHub
3. Smart contract deployed on your target network

### Steps for Vercel Deployment

1. **Connect Repository to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository: `https://github.com/Dipraise1/publicfund.git`

2. **Configure Build Settings**
   - Framework Preset: `Create React App`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `build`

3. **Environment Variables**
   Set these environment variables in Vercel:
   ```
   REACT_APP_CONTRACT_ADDRESS=your_deployed_contract_address
   REACT_APP_NETWORK_NAME=sepolia (or your target network)
   REACT_APP_NETWORK_ID=11155111 (or your network ID)
   REACT_APP_RPC_URL=your_rpc_endpoint
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy your app

### Production Checklist

- [ ] Smart contract deployed on target network
- [ ] Contract address updated in environment variables
- [ ] Network configuration matches deployment network
- [ ] Mobile responsiveness tested
- [ ] MetaMask integration working
- [ ] Error handling tested
- [ ] Build successful without warnings

### Local Testing Before Deployment

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create production build
npm run build

# Test production build locally
npm install -g serve
serve -s build
```

### Troubleshooting

1. **Build Failures**
   - Check for ESLint warnings/errors
   - Ensure all dependencies are installed
   - Verify environment variables are set

2. **Contract Connection Issues**
   - Verify contract address is correct
   - Check network configuration
   - Ensure RPC endpoint is accessible

3. **Mobile Issues**
   - Test on various screen sizes
   - Check touch interactions
   - Verify responsive design

### Post-Deployment

1. Test all functionality on the deployed site
2. Verify MetaMask connection works
3. Test donation and voting features
4. Check mobile responsiveness
5. Monitor for any console errors

## Smart Contract Deployment

For production deployment, you'll need to:

1. Deploy contracts to a testnet (Sepolia) or mainnet
2. Update the contract addresses in your frontend
3. Configure proper network settings
4. Test thoroughly before going live

## Security Considerations

- Never commit private keys or sensitive data
- Use environment variables for all configuration
- Test on testnets before mainnet deployment
- Implement proper error handling
- Consider rate limiting and DDoS protection 