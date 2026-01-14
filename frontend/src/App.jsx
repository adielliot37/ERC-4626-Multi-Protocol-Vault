import { useState, useEffect, useCallback } from 'react'
import { useAccount, useChainId, useSwitchChain, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { sepolia } from 'wagmi/chains'
import { formatUnits, formatEther, parseUnits, parseEther, isAddress } from 'viem'
import { StrategyInfo } from './StrategyInfo'
import './App.css'

const ERC20_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
]

const VAULT_ABI = [
  { inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], name: 'deposit', outputs: [{ name: 'shares', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], name: 'withdraw', outputs: [{ name: 'shares', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], name: 'redeem', outputs: [{ name: 'assets', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'totalAssets', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'assets', type: 'uint256' }], name: 'convertToShares', outputs: [{ name: 'shares', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'shares', type: 'uint256' }], name: 'convertToAssets', outputs: [{ name: 'assets', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'assets', type: 'uint256' }], name: 'previewDeposit', outputs: [{ name: 'shares', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'shares', type: 'uint256' }], name: 'previewRedeem', outputs: [{ name: 'assets', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'assets', type: 'uint256' }], name: 'previewWithdraw', outputs: [{ name: 'shares', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'maxWithdraw', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'maxRedeem', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getStrategiesCount', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'index', type: 'uint256' }], name: 'getStrategyInfo', outputs: [{ name: 'strategy', type: 'address' }, { name: 'allocationBps', type: 'uint256' }, { name: 'active', type: 'bool' }, { name: 'totalAssetsInStrategy', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'requestId', type: 'uint256' }], name: 'claimWithdrawal', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }, { name: 'requestId', type: 'uint256' }], name: 'getPendingWithdrawalInfo', outputs: [{ name: 'strategy', type: 'address' }, { name: 'strategyRequestId', type: 'uint256' }, { name: 'amount', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'withdrawalRequestCount', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }, { name: 'requestId', type: 'uint256' }], name: 'getPendingWithdrawalInfo', outputs: [{ name: 'strategy', type: 'address' }, { name: 'strategyRequestId', type: 'uint256' }, { name: 'amount', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'withdrawalRequestCount', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'rebalance', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'index', type: 'uint256' }, { name: 'allocationBps', type: 'uint256' }], name: 'updateStrategyAllocation', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'strategy', type: 'address' }, { name: 'allocationBps', type: 'uint256' }], name: 'addStrategy', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'MANAGER_ROLE', outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }], name: 'hasRole', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
]

const STRATEGY_ABI = [
  { inputs: [], name: 'totalAssets', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'hasLockup', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
]

const VAULT_ADDRESS = '0xE16B4cCD109649DdcA66c50Bb627F77c4a96e77c'
const USDC_ADDRESS = '0x63653c34d5f96Ac0F6fb780EDd2eE9384211Fe22'
const STRATEGY1_ADDRESS = '0xa0532ac24813E2a04594b9554f2D73b44640c7a4'
const STRATEGY2_ADDRESS = '0x4AC1201EE7BF886EfdFA7d4d19678B536Ff0c35a'

function App() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const [vaultAddress, setVaultAddress] = useState('0xE16B4cCD109649DdcA66c50Bb627F77c4a96e77c')
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [redeemShares, setRedeemShares] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isManager, setIsManager] = useState(false)
  const [allocationInputs, setAllocationInputs] = useState({})
  const [depositStep, setDepositStep] = useState('')
  const [pendingDepositAmount, setPendingDepositAmount] = useState('')
  const [initialDepositValue, setInitialDepositValue] = useState(0n)
  const [pendingWithdrawals, setPendingWithdrawals] = useState([])
  useEffect(() => {
    if (isConnected && chainId !== sepolia.id) {
      switchChain({ chainId: sepolia.id })
    }
  }, [isConnected, chainId, switchChain])

  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isAddress(USDC_ADDRESS), refetchInterval: 5000 },
  })
  
  const { data: usdcDecimals } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: isAddress(USDC_ADDRESS) },
  })

  const { data: vaultShares, refetch: refetchVaultShares } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isAddress(vaultAddress), refetchInterval: 5000 },
  })

  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
    query: { enabled: isAddress(vaultAddress), refetchInterval: 5000 },
  })

  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'totalSupply',
    query: { enabled: isAddress(vaultAddress), refetchInterval: 5000 },
  })

  const { data: strategiesCount, refetch: refetchStrategiesCount } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'getStrategiesCount',
    query: { enabled: isAddress(vaultAddress), refetchInterval: 5000 },
  })

  const { data: maxWithdraw, refetch: refetchMaxWithdraw } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'maxWithdraw',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isAddress(vaultAddress), refetchInterval: 5000 },
  })

  const { data: maxRedeem, refetch: refetchMaxRedeem } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'maxRedeem',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isAddress(vaultAddress), refetchInterval: 5000 },
  })

  const { data: withdrawalRequestCount, refetch: refetchWithdrawalRequestCount } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'withdrawalRequestCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isAddress(vaultAddress), refetchInterval: 5000 },
  })

  const { data: strategy0Info, refetch: refetchStrategy0 } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'getStrategyInfo',
    args: [BigInt(0)],
    query: { enabled: isAddress(vaultAddress) && strategiesCount && Number(strategiesCount) >= 1, refetchInterval: 5000 },
  })

  const { data: strategy1Info, refetch: refetchStrategy1 } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'getStrategyInfo',
    args: [BigInt(1)],
    query: { enabled: isAddress(vaultAddress) && strategiesCount && Number(strategiesCount) >= 2, refetchInterval: 5000 },
  })

  const MANAGER_ROLE_HASH = '0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08'
  
  const { data: hasManagerRole } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'hasRole',
    args: address && isAddress(vaultAddress) ? [MANAGER_ROLE_HASH, address] : undefined,
    query: { enabled: !!address && isAddress(vaultAddress) },
  })

  useEffect(() => {
    if (hasManagerRole !== undefined) {
      setIsManager(!!hasManagerRole)
    }
  }, [hasManagerRole])

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && isAddress(vaultAddress) ? [address, vaultAddress] : undefined,
    query: { enabled: !!address && isAddress(vaultAddress), refetchInterval: 5000 },
  })

  const handleDepositAfterApproval = useCallback(async (amountStr) => {
    if (!address || !amountStr) return
    setError('')
    
    try {
      const amount = parseUnits(amountStr, usdcDecimals || 18)
      writeContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [amount, address],
      })
      setDepositAmount('')
      setPendingDepositAmount('')
    } catch (err) {
      setError('Deposit failed: ' + (err.message || err.toString()))
      setDepositStep('')
      setPendingDepositAmount('')
    }
  }, [address, vaultAddress, usdcDecimals, writeContract])

  const refetchAllData = useCallback(() => {
    refetchUsdcBalance()
    refetchVaultShares()
    refetchTotalAssets()
    refetchTotalSupply()
    refetchStrategiesCount()
    refetchAllowance()
    refetchStrategy0()
    refetchStrategy1()
    refetchMaxWithdraw()
    refetchMaxRedeem()
    refetchWithdrawalRequestCount()
  }, [refetchUsdcBalance, refetchVaultShares, refetchTotalAssets, refetchTotalSupply, refetchStrategiesCount, refetchAllowance, refetchStrategy0, refetchStrategy1, refetchMaxWithdraw, refetchMaxRedeem, refetchWithdrawalRequestCount])

  useEffect(() => {
    if (isConfirmed) {
      setTimeout(() => {
        refetchAllData()
      }, 1000)
      setTimeout(() => {
        refetchAllData()
      }, 3000)
      setTimeout(() => {
        refetchAllData()
      }, 5000)
      
      
      if (depositStep === 'approve' && pendingDepositAmount) {
        setDepositStep('deposit')
        setSuccess('Approval confirmed! Initiating deposit...')
        
        setTimeout(() => {
          handleDepositAfterApproval(pendingDepositAmount)
        }, 1000)
      } else if (depositStep === 'deposit') {
        setSuccess('Deposit confirmed!')
        setError('')
        setTimeout(() => {
          setSuccess('')
          setDepositStep('')
          setPendingDepositAmount('')
        }, 5000)
      } else {
        setSuccess('Transaction confirmed!')
        setError('')
        setTimeout(() => {
          setSuccess('')
          setDepositStep('')
          setPendingDepositAmount('')
        }, 5000)
      }
    }
  }, [isConfirmed, depositStep, pendingDepositAmount, handleDepositAfterApproval, refetchAllData])

  const handleDeposit = async () => {
    if (!address || !depositAmount) return
    setError('')
    setSuccess('')

    try {
      const amount = parseUnits(depositAmount, usdcDecimals || 18)
      
      // Check if approval is needed
      if (!allowance || allowance < amount) {
        // Set pending deposit amount and step
        setPendingDepositAmount(depositAmount)
        setDepositStep('approve')
        
        // Approve first
        writeContract({
          address: USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [vaultAddress, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
        })
        setSuccess('Step 1/2: Please approve USDC spending. Deposit will start automatically after approval.')
        return
      }

      // Already approved, deposit directly
      writeContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [amount, address],
      })
      setDepositAmount('')
    } catch (err) {
      setError('Deposit failed: ' + (err.message || err.toString()))
      setDepositStep('')
      setPendingDepositAmount('')
    }
  }

  const handleWithdraw = async () => {
    if (!address || !withdrawAmount) return
    setError('')
    setSuccess('')

    try {
      const amount = parseUnits(withdrawAmount, usdcDecimals || 18)
      writeContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'withdraw',
        args: [amount, address, address],
      })
      setWithdrawAmount('')
    } catch (err) {
      setError('Withdraw failed: ' + (err.message || err.toString()))
    }
  }

  const handleRedeem = async () => {
    if (!address || !redeemShares) return
    setError('')
    setSuccess('')

    try {
      const shares = parseEther(redeemShares)
      writeContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'redeem',
        args: [shares, address, address],
      })
      setRedeemShares('')
      setSuccess('Redeeming shares. If some assets are locked, they will be queued for withdrawal.')
    } catch (err) {
      setError('Redeem failed: ' + (err.message || err.toString()))
    }
  }

  const handleClaimWithdrawal = async (requestId) => {
    if (!address) return
    setError('')
    setSuccess('')

    try {
      writeContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'claimWithdrawal',
        args: [BigInt(requestId)],
      })
      setSuccess(`Claiming withdrawal request #${requestId}...`)
    } catch (err) {
      setError('Claim withdrawal failed: ' + (err.message || err.toString()))
    }
  }

  const handleRebalance = async () => {
    if (!address) return
    setError('')
    setSuccess('')

    try {
      writeContract({
        address: vaultAddress,
        abi: VAULT_ABI,
        functionName: 'rebalance',
        args: [],
      })
    } catch (err) {
      setError('Rebalance failed: ' + (err.message || err.toString()))
    }
  }

  const handleUpdateAllocation = async (strategyIndex, allocationPercent) => {
    if (!address || !isManager) return
    setError('')
    setSuccess('')

    try {
      // Convert percentage to basis points (e.g., 40% = 4000 bps)
      const allocationBps = BigInt(Math.floor(allocationPercent * 100))
      
      // If we have exactly 2 strategies, auto-balance the other one to total 100%
      if (strategiesCount && Number(strategiesCount) === 2) {
        const otherStrategyIndex = strategyIndex === 0 ? 1 : 0
        const remainingBps = BigInt(10000) - allocationBps // 10000 = 100% in basis points
        
        // Update the first strategy
        writeContract({
          address: vaultAddress,
          abi: VAULT_ABI,
          functionName: 'updateStrategyAllocation',
          args: [BigInt(strategyIndex), allocationBps],
        })
        
        // Update the other strategy to balance to 100%
        // Use a small delay to ensure first transaction is processed
        setTimeout(() => {
          writeContract({
            address: vaultAddress,
            abi: VAULT_ABI,
            functionName: 'updateStrategyAllocation',
            args: [BigInt(otherStrategyIndex), remainingBps],
          })
        }, 500)
        
        setSuccess(`Updating Strategy ${strategyIndex + 1} to ${allocationPercent}% and Strategy ${otherStrategyIndex + 1} to ${Number(remainingBps) / 100}%...`)
      } else {
        // For more than 2 strategies, just update the one
        writeContract({
          address: vaultAddress,
          abi: VAULT_ABI,
          functionName: 'updateStrategyAllocation',
          args: [BigInt(strategyIndex), allocationBps],
        })
        setSuccess(`Updating Strategy ${strategyIndex + 1} allocation to ${allocationPercent}%...`)
      }
    } catch (err) {
      setError('Update allocation failed: ' + (err.message || err.toString()))
    }
  }

  const userInvestedAmount = vaultShares && totalAssets && totalSupply && totalSupply > 0n
    ? (vaultShares * totalAssets) / totalSupply
    : 0n

  const sharePrice = totalSupply && totalSupply > 0n && totalAssets
    ? (totalAssets * BigInt(1e18)) / totalSupply
    : BigInt(1e18)

  // For simplicity, we'll calculate yield based on share price increase
  const yieldEarned = userInvestedAmount > 0n && sharePrice > BigInt(1e18)
    ? userInvestedAmount - (vaultShares * BigInt(1e18) / BigInt(1e18)) // Simplified: assumes 1:1 initial
    : 0n

  // Calculate yield percentage
  const yieldPercentage = userInvestedAmount > 0n && sharePrice > BigInt(1e18)
    ? Number((sharePrice - BigInt(1e18)) * BigInt(10000)) / Number(BigInt(1e18))
    : 0

  // Calculate APY (simplified - would need historical data for real APY)
  // This is just showing if share price is above 1.0
  const apy = sharePrice > BigInt(1e18) 
    ? Number((sharePrice - BigInt(1e18)) * BigInt(10000)) / Number(BigInt(1e18))
    : 0

  const loading = isPending || isConfirming

  if (!isConnected) {
    return (
      <div className="container" style={{ color: '#ffffff' }}>
        <div className="vault-header" style={{ color: '#ffffff' }}>
          <h1 style={{ color: '#ffffff' }}>Multi-Protocol Vault</h1>
          <p style={{ color: '#888888', marginTop: '10px', fontSize: '1.1em' }}>ERC-4626 Compliant Vault with Multi-Protocol Routing</p>
        </div>
        <div className="card connect-wallet" style={{ color: '#ffffff' }}>
          <h2 style={{ color: '#ffffff' }}>Connect Your Wallet</h2>
          <p style={{ color: '#888888', marginBottom: '30px' }}>Connect to Sepolia testnet to interact with the vault</p>
          <ConnectButton />
        </div>
      </div>
    )
  }

  const isWrongNetwork = chainId !== sepolia.id

  return (
    <div className="container" style={{ color: '#ffffff' }}>
      <div className="vault-header" style={{ color: '#ffffff' }}>
        <h1 style={{ color: '#ffffff' }}>Multi-Protocol Vault</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
          <div className={`network-badge ${isWrongNetwork ? 'wrong' : 'connected'}`}>
            {isWrongNetwork ? 'Wrong Network' : 'Sepolia Network'}
          </div>
          <ConnectButton />
        </div>
      </div>

      {isWrongNetwork && (
        <div className="error">
          Please switch to Sepolia testnet. The app will automatically switch for you.
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
        <h2 style={{ marginBottom: '20px' }}>How It Works</h2>
        <div style={{ lineHeight: '1.8', color: '#cccccc' }}>
          <div style={{ marginBottom: '15px' }}>
            <strong style={{ color: '#ffffff' }}>1. Deposit USDC:</strong> When you deposit, your USDC is automatically split between multiple strategies based on allocation percentages.
          </div>
          <div style={{ marginBottom: '15px' }}>
            <strong style={{ color: '#ffffff' }}>2. Receive Shares:</strong> You receive vault shares (MPV tokens) representing your portion of the total vault assets.
          </div>
          <div style={{ marginBottom: '15px' }}>
            <strong style={{ color: '#ffffff' }}>3. Yield Generation:</strong> Your funds earn yield through the underlying strategies. Share price increases as strategies generate returns.
          </div>
          <div style={{ marginBottom: '15px' }}>
            <strong style={{ color: '#ffffff' }}>4. Withdraw:</strong>
            <ul style={{ marginLeft: '20px', marginTop: '8px', paddingLeft: '20px' }}>
              <li><strong>Instant:</strong> From strategies without lockup (immediate)</li>
              <li><strong>Queued:</strong> From strategies with lockup (7-day wait, then claim)</li>
            </ul>
          </div>
          <div style={{ marginBottom: '0' }}>
            <strong style={{ color: '#ffffff' }}>5. Managers:</strong> Can update strategy allocations and rebalance funds to optimize returns.
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Vault Configuration</h2>
        <div className="input-group">
          <label className="input-label">Vault Contract Address</label>
          <input
            type="text"
            value={vaultAddress}
            onChange={(e) => setVaultAddress(e.target.value)}
            placeholder="Enter vault address"
          />
        </div>
        <div style={{ marginTop: '15px', fontSize: '12px', color: '#888888' }}>
          <div>Strategy 1 (No Lockup): {STRATEGY1_ADDRESS}</div>
          <div style={{ marginTop: '5px' }}>Strategy 2 (With Lockup): {STRATEGY2_ADDRESS}</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{usdcBalance ? formatUnits(usdcBalance, usdcDecimals || 18) : '0.00'}</div>
          <div className="stat-label">USDC Balance</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{vaultShares ? formatEther(vaultShares) : '0.00'}</div>
          <div className="stat-label">Vault Shares (MPV)</div>
          {vaultShares && vaultShares > 0n && (
            <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '5px' }}>
              Yield-bearing tokens
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-value">{userInvestedAmount > 0n ? formatUnits(userInvestedAmount, usdcDecimals || 18) : '0.00'}</div>
          <div className="stat-label">Your Investment Value</div>
          {yieldPercentage > 0 && (
            <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '5px' }}>
              +{yieldPercentage.toFixed(4)}% yield
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalAssets ? formatUnits(totalAssets, usdcDecimals || 18) : '0.00'}</div>
          <div className="stat-label">Total Vault Assets</div>
        </div>
      </div>

      {/* Withdrawal Information Card */}
      {vaultShares && vaultShares > 0n && (
        <div className="card" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', marginTop: '20px' }}>
          <h2 style={{ marginBottom: '20px' }}>Withdrawal Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <div style={{ padding: '16px', backgroundColor: '#0f0f0f', borderRadius: '8px', border: '1px solid #333' }}>
              <div style={{ color: '#888888', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>Max Withdrawable (Assets)</div>
              <div style={{ color: '#4ade80', fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                {maxWithdraw ? formatUnits(maxWithdraw, usdcDecimals || 18) : '0.00'} USDC
              </div>
              <div style={{ color: '#666666', fontSize: '11px' }}>
                Instant withdrawal available (from strategies without lockup)
              </div>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#0f0f0f', borderRadius: '8px', border: '1px solid #333' }}>
              <div style={{ color: '#888888', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>Max Redeemable (Shares)</div>
              <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                {maxRedeem ? formatEther(maxRedeem) : '0.00'} MPV
              </div>
              <div style={{ color: '#666666', fontSize: '11px' }}>
                All your shares (may include locked assets)
              </div>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#0f0f0f', borderRadius: '8px', border: '1px solid #333' }}>
              <div style={{ color: '#888888', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>Potentially Locked</div>
              <div style={{ color: '#ffaa00', fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                {maxRedeem && maxWithdraw && userInvestedAmount > maxWithdraw
                  ? formatUnits(userInvestedAmount - maxWithdraw, usdcDecimals || 18)
                  : '0.00'} USDC
              </div>
              <div style={{ color: '#666666', fontSize: '11px' }}>
                Assets in strategies with lockup (7-day wait)
              </div>
            </div>
          </div>
          <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#0f0f0f', borderRadius: '8px', border: '1px solid #444' }}>
            <div style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>Withdraw vs Redeem</div>
            <div style={{ color: '#cccccc', fontSize: '13px', lineHeight: '1.8' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: '#4ade80' }}>Withdraw (Assets):</strong> Specify USDC amount. Withdraws instantly from available strategies. If amount exceeds instant liquidity, remaining is queued for 7 days.
              </div>
              <div>
                <strong style={{ color: '#ffffff' }}>Redeem (Shares):</strong> Specify MPV share amount. Converts shares to USDC. May include locked assets that need to be claimed later.
              </div>
            </div>
          </div>
        </div>
      )}

      {vaultShares && vaultShares > 0n && (
        <div className="card" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
          <h2 style={{ marginBottom: '20px' }}>Your Investment Details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div>
              <div style={{ color: '#888888', fontSize: '14px', marginBottom: '5px' }}>Share Price</div>
              <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold' }}>
                {formatUnits(sharePrice, 18)} USDC
              </div>
            </div>
            <div>
              <div style={{ color: '#888888', fontSize: '14px', marginBottom: '5px' }}>Your Shares</div>
              <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold' }}>
                {formatEther(vaultShares)} MPV
              </div>
            </div>
            <div>
              <div style={{ color: '#888888', fontSize: '14px', marginBottom: '5px' }}>Current Value</div>
              <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold' }}>
                {formatUnits(userInvestedAmount, usdcDecimals || 18)} USDC
              </div>
            </div>
            {yieldPercentage > 0 && (
              <div>
                <div style={{ color: '#888888', fontSize: '14px', marginBottom: '5px' }}>Yield Earned</div>
                <div style={{ color: '#4ade80', fontSize: '18px', fontWeight: 'bold' }}>
                  +{yieldPercentage.toFixed(4)}%
                </div>
              </div>
            )}
            {apy > 0 && (
              <div>
                <div style={{ color: '#888888', fontSize: '14px', marginBottom: '5px' }}>Estimated APY</div>
                <div style={{ color: '#4ade80', fontSize: '18px', fontWeight: 'bold' }}>
                  +{apy.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
          
          {yieldPercentage > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #333' }}>
              <h3 style={{ color: '#ffffff', fontSize: '16px', marginBottom: '15px' }}>Yield Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div>
                  <div style={{ color: '#888888', fontSize: '12px', marginBottom: '4px' }}>Yield Tokens (MPV Shares)</div>
                  <div style={{ color: '#4ade80', fontSize: '16px', fontWeight: 'bold' }}>
                    {formatEther(vaultShares)} MPV
                  </div>
                  <div style={{ color: '#666666', fontSize: '11px', marginTop: '4px' }}>
                    Your vault shares represent yield-bearing tokens
                  </div>
                </div>
                <div>
                  <div style={{ color: '#888888', fontSize: '12px', marginBottom: '4px' }}>Yield Value</div>
                  <div style={{ color: '#4ade80', fontSize: '16px', fontWeight: 'bold' }}>
                    {yieldEarned > 0n ? formatUnits(yieldEarned, usdcDecimals || 18) : '0.00'} USDC
                  </div>
                  <div style={{ color: '#666666', fontSize: '11px', marginTop: '4px' }}>
                    Additional value from yield generation
                  </div>
                </div>
                <div>
                  <div style={{ color: '#888888', fontSize: '12px', marginBottom: '4px' }}>Yield Rate</div>
                  <div style={{ color: '#4ade80', fontSize: '16px', fontWeight: 'bold' }}>
                    {yieldPercentage.toFixed(4)}%
                  </div>
                  <div style={{ color: '#666666', fontSize: '11px', marginTop: '4px' }}>
                    Current yield percentage
                  </div>
                </div>
              </div>
            </div>
          )}

          {totalSupply && totalSupply > 0n && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #333' }}>
              <div style={{ color: '#888888', fontSize: '14px', marginBottom: '5px' }}>Your Share of Vault</div>
              <div style={{ color: '#ffffff', fontSize: '16px' }}>
                {((Number(vaultShares) / Number(totalSupply)) * 100).toFixed(4)}%
              </div>
            </div>
          )}
        </div>
      )}

      {strategiesCount && Number(strategiesCount) > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Strategies</h2>
            {isManager && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: '#888888', fontSize: '12px', textTransform: 'uppercase' }}>Manager Mode</span>
                <button onClick={handleRebalance} disabled={loading} style={{ margin: 0 }}>
                  {loading ? 'Processing...' : 'Rebalance'}
                </button>
              </div>
            )}
          </div>
          <div className="strategy-grid">
            {Array.from({ length: Number(strategiesCount) }).map((_, i) => {
              // Get the other strategy's allocation for auto-balancing
              let otherAllocation = 0
              if (Number(strategiesCount) === 2) {
                const otherInfo = i === 0 ? strategy1Info : strategy0Info
                otherAllocation = otherInfo ? Number(otherInfo[1]) / 100 : 0
              }
              
              return (
                <StrategyInfo 
                  key={i} 
                  vaultAddress={vaultAddress} 
                  index={i}
                  isManager={isManager}
                  onUpdateAllocation={handleUpdateAllocation}
                  allocationInput={allocationInputs[i] || ''}
                  setAllocationInput={(value) => setAllocationInputs({...allocationInputs, [i]: value})}
                  strategiesCount={Number(strategiesCount)}
                  otherStrategyAllocation={otherAllocation}
                />
              )
            })}
          </div>
          {!isManager && (
            <p style={{ color: '#888888', fontSize: '14px', marginTop: '20px', textAlign: 'center' }}>
              Only managers can update allocations and rebalance
            </p>
          )}
        </div>
      )}

      <div className="action-section">
        <div className="action-card">
          <h2>Deposit</h2>
          {depositStep === 'approve' && (
            <div style={{ 
              padding: '12px', 
              marginBottom: '15px', 
              backgroundColor: '#1a3a1a', 
              border: '1px solid #4ade80',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#4ade80'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Step 1/2: Approval</div>
              <div>Please approve USDC spending in your wallet. Deposit will start automatically after approval.</div>
            </div>
          )}
          {depositStep === 'deposit' && (
            <div style={{ 
              padding: '12px', 
              marginBottom: '15px', 
              backgroundColor: '#1a3a1a', 
              border: '1px solid #4ade80',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#4ade80'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Step 2/2: Depositing</div>
              <div>Approval confirmed! Depositing {pendingDepositAmount} USDC...</div>
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Amount (USDC)</label>
            <input
              type="number"
              placeholder="0.00"
              value={depositAmount}
              onChange={(e) => {
                setDepositAmount(e.target.value)
                // Reset step if user changes amount
                if (depositStep) {
                  setDepositStep('')
                  setPendingDepositAmount('')
                }
              }}
              disabled={depositStep === 'approve' || depositStep === 'deposit'}
            />
          </div>
          <button 
            onClick={handleDeposit} 
            disabled={loading || !depositAmount || depositStep === 'approve' || depositStep === 'deposit'}
          >
            {loading 
              ? (depositStep === 'approve' ? 'Approving...' : depositStep === 'deposit' ? 'Depositing...' : 'Processing...')
              : depositStep === 'approve' 
                ? 'Waiting for Approval...' 
                : depositStep === 'deposit'
                  ? 'Depositing...'
                  : 'Deposit'
            }
          </button>
        </div>

        <div className="action-card">
          <h2>Withdraw (Assets)</h2>
          {maxWithdraw !== undefined && (
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1a3a1a', borderRadius: '6px', border: '1px solid #4ade80' }}>
              <div style={{ color: '#888888', fontSize: '11px', marginBottom: '4px' }}>Available to Withdraw</div>
              <div style={{ color: '#4ade80', fontSize: '16px', fontWeight: 'bold' }}>
                {formatUnits(maxWithdraw, usdcDecimals || 18)} USDC
              </div>
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Amount (USDC)</label>
            <input
              type="number"
              placeholder="0.00"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              max={maxWithdraw ? formatUnits(maxWithdraw, usdcDecimals || 18) : undefined}
            />
            {maxWithdraw && (
              <button
                onClick={() => setWithdrawAmount(formatUnits(maxWithdraw, usdcDecimals || 18))}
                style={{ marginTop: '8px', fontSize: '12px', padding: '4px 8px', backgroundColor: 'transparent', border: '1px solid #444', color: '#888888' }}
              >
                Use Max ({formatUnits(maxWithdraw, usdcDecimals || 18)})
              </button>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#888888', marginBottom: '10px' }}>
            Withdraws USDC. Instant from available strategies, queued from locked strategies.
          </div>
          <button onClick={handleWithdraw} disabled={loading || !withdrawAmount || (maxWithdraw && parseFloat(withdrawAmount) > parseFloat(formatUnits(maxWithdraw, usdcDecimals || 18)))}>
            {loading ? 'Processing...' : 'Withdraw'}
          </button>
        </div>

        <div className="action-card">
          <h2>Redeem (Shares)</h2>
          {maxRedeem !== undefined && (
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1a1a3a', borderRadius: '6px', border: '1px solid #8888ff' }}>
              <div style={{ color: '#888888', fontSize: '11px', marginBottom: '4px' }}>Available to Redeem</div>
              <div style={{ color: '#8888ff', fontSize: '16px', fontWeight: 'bold' }}>
                {formatEther(maxRedeem)} MPV Shares
              </div>
              {maxRedeem > 0n && userInvestedAmount > 0n && (
                <div style={{ color: '#666666', fontSize: '11px', marginTop: '4px' }}>
                  ≈ {formatUnits(userInvestedAmount, usdcDecimals || 18)} USDC
                </div>
              )}
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Number of Shares (MPV)</label>
            <input
              type="number"
              placeholder="0.00"
              value={redeemShares}
              onChange={(e) => setRedeemShares(e.target.value)}
              max={maxRedeem ? formatEther(maxRedeem) : undefined}
            />
            {maxRedeem && maxRedeem > 0n && (
              <button
                onClick={() => setRedeemShares(formatEther(maxRedeem))}
                style={{ marginTop: '8px', fontSize: '12px', padding: '4px 8px', backgroundColor: 'transparent', border: '1px solid #444', color: '#888888' }}
              >
                Use Max ({formatEther(maxRedeem)})
              </button>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#888888', marginBottom: '10px' }}>
            Converts MPV shares to USDC. May include locked assets requiring claim later.
          </div>
          <button onClick={handleRedeem} disabled={loading || !redeemShares || (maxRedeem && parseFloat(redeemShares) > parseFloat(formatEther(maxRedeem)))}>
            {loading ? 'Processing...' : 'Redeem'}
          </button>
        </div>
      </div>

      {withdrawalRequestCount && Number(withdrawalRequestCount) > 0 && (
        <div className="card" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', marginTop: '20px' }}>
          <h2 style={{ marginBottom: '20px' }}>Pending Withdrawals</h2>
          <div style={{ color: '#ffaa00', fontSize: '14px', marginBottom: '20px', padding: '12px', backgroundColor: '#2a1a00', borderRadius: '8px', border: '1px solid #ffaa00' }}>
            <strong>Locked Assets:</strong> You have {Number(withdrawalRequestCount)} withdrawal request{Number(withdrawalRequestCount) > 1 ? 's' : ''}. 
            These are assets from strategies with lockup. <strong>You can try claiming anytime</strong> - if the 7-day period has passed, it will succeed. 
            If not, you'll need to wait. In mock strategies, you can usually claim immediately.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: Number(withdrawalRequestCount) }).map((_, i) => (
              <PendingWithdrawalItem
                key={i}
                vaultAddress={vaultAddress}
                userAddress={address}
                requestId={i}
                onClaim={handleClaimWithdrawal}
                usdcDecimals={usdcDecimals || 18}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PendingWithdrawalItem({ vaultAddress, userAddress, requestId, onClaim, usdcDecimals }) {
  const { data: withdrawalInfo } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'getPendingWithdrawalInfo',
    args: userAddress ? [userAddress, BigInt(requestId)] : undefined,
    query: { enabled: !!userAddress && isAddress(vaultAddress), refetchInterval: 5000 },
  })

  const isClaimed = !withdrawalInfo || withdrawalInfo[2] === 0n

  if (isClaimed) {
    return (
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#0f1a0f', 
        borderRadius: '8px', 
        border: '1px solid #4ade80',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#4ade80', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            Request #{requestId} - Claimed
          </div>
          <div style={{ color: '#888888', fontSize: '14px' }}>
            This withdrawal has been successfully claimed.
          </div>
        </div>
        <div style={{ 
          padding: '8px 16px',
          backgroundColor: '#1a3a1a',
          color: '#4ade80',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: 'bold'
        }}>
          Claimed
        </div>
      </div>
    )
  }

  const [strategyAddress, strategyRequestId, amount] = withdrawalInfo

  const STRATEGY_ABI_FOR_WITHDRAWAL = [
    { inputs: [{ name: 'user', type: 'address' }, { name: 'requestId', type: 'uint256' }], name: 'getPendingWithdrawal', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  ]

  const { data: strategyPendingAmount } = useReadContract({
    address: strategyAddress,
    abi: STRATEGY_ABI_FOR_WITHDRAWAL,
    functionName: 'getPendingWithdrawal',
    args: [vaultAddress, BigInt(strategyRequestId)],
    query: { enabled: !!strategyAddress && strategyAddress !== '0x0000000000000000000000000000000000000000', refetchInterval: 5000 },
  })

  const isReady = strategyPendingAmount !== undefined && strategyPendingAmount > 0n

  return (
    <div style={{ 
      padding: '16px', 
      backgroundColor: '#0f0f0f', 
      borderRadius: '8px', 
      border: isReady ? '1px solid #4ade80' : '1px solid #ffaa00',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#ffffff', fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
          Request #{requestId}
          {isReady && (
            <span style={{ color: '#4ade80', fontSize: '12px', marginLeft: '8px' }}>Ready to Claim</span>
          )}
          {!isReady && (
            <span style={{ color: '#ffaa00', fontSize: '12px', marginLeft: '8px' }}>Waiting (7 days)</span>
          )}
        </div>
        <div style={{ color: '#888888', fontSize: '14px', marginBottom: '4px' }}>
          Amount: <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{formatUnits(amount, usdcDecimals)} USDC</span>
        </div>
        <div style={{ color: '#666666', fontSize: '12px', marginBottom: '4px' }}>
          Strategy: {strategyAddress.slice(0, 6)}...{strategyAddress.slice(-4)}
        </div>
        {!isReady && (
          <div style={{ color: '#ffaa00', fontSize: '12px', marginTop: '8px', padding: '8px', backgroundColor: '#2a1a00', borderRadius: '4px' }}>
            You can try claiming anytime. In mock strategies, you can usually claim immediately. 
            In production, you may need to wait 7 days for the lockup period.
          </div>
        )}
        {isReady && (
          <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '8px', padding: '8px', backgroundColor: '#1a3a1a', borderRadius: '4px' }}>
            Ready! The strategy has funds available. You can claim now.
          </div>
        )}
      </div>
      <button
        onClick={() => onClaim(requestId)}
        style={{
          padding: '10px 20px',
          backgroundColor: isReady ? '#4ade80' : '#ffaa00',
          color: '#000000',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        {isReady ? 'Claim' : 'Try Claim Now'}
      </button>
    </div>
  )
}

export default App
