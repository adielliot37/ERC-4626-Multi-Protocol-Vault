import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { isAddress } from 'viem'

const VAULT_ABI = [
  { inputs: [{ name: 'index', type: 'uint256' }], name: 'getStrategyInfo', outputs: [{ name: 'strategy', type: 'address' }, { name: 'allocationBps', type: 'uint256' }, { name: 'active', type: 'bool' }, { name: 'totalAssetsInStrategy', type: 'uint256' }], stateMutability: 'view', type: 'function' },
]

export function StrategyInfo({ vaultAddress, index, isManager, onUpdateAllocation, allocationInput, setAllocationInput, strategiesCount, otherStrategyAllocation }) {
  const { data: strategyInfo } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: 'getStrategyInfo',
    args: [BigInt(index)],
    query: { enabled: isAddress(vaultAddress), refetchInterval: 5000 },
  })

  if (!strategyInfo) return null

  const [strategyAddr, allocationBps, active, assets] = strategyInfo

  return (
    <div className="strategy-item">
      <div className="info-row">
        <span className="info-label">Strategy {index + 1}</span>
        <span className="badge no-lockup">{active ? 'Active' : 'Inactive'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Allocation</span>
        <span className="info-value">{Number(allocationBps) / 100}%</span>
      </div>
      <div className="info-row">
        <span className="info-label">Assets</span>
        <span className="info-value">{formatUnits(assets, 18)} USDC</span>
      </div>
      <div className="info-row">
        <span className="info-label">Address</span>
        <span className="info-value" style={{ fontSize: '12px', wordBreak: 'break-all' }}>{strategyAddr}</span>
      </div>
      {isManager && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #222222' }}>
          <div className="input-group">
            <label className="input-label">Update Allocation (%)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min="0"
                max="80"
                step="0.1"
                value={allocationInput || ''}
                onChange={(e) => setAllocationInput(e.target.value)}
                placeholder={Number(allocationBps) / 100}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => {
                  const percent = parseFloat(allocationInput || '0')
                  if (percent >= 0 && percent <= 80) {
                    onUpdateAllocation(index, percent)
                  } else {
                    alert('Allocation must be between 0% and 80%')
                  }
                }}
                disabled={!allocationInput || parseFloat(allocationInput) < 0 || parseFloat(allocationInput) > 80}
                style={{ margin: 0 }}
              >
                Update
              </button>
              {strategiesCount === 2 && allocationInput && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#888888' }}>
                  Other strategy will auto-balance to {(100 - parseFloat(allocationInput || '0')).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

