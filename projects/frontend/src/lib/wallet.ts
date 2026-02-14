import algosdk from 'algosdk'
import {
  ScopeType,
  WalletId,
  WalletManager,
  type SignDataResponse,
  type SignMetadata,
  type WalletAccount,
} from '@txnlab/use-wallet-react'

import { getConfig } from './config'
import { fromStringToBytes } from './utils'

const LOCAL_WALLET_NAME = 'unencrypted-default-wallet'
const CACHED_ADDRESS_KEY = 'algocampus.customWallet.address'

type TxInput = algosdk.Transaction | Uint8Array

const toHandleToken = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object') {
    const maybe = value as Record<string, unknown>
    const token = maybe.wallet_handle_token ?? maybe.walletHandleToken
    if (typeof token === 'string') {
      return token
    }
  }
  throw new Error('Unable to initialize KMD wallet handle')
}

const firstAddress = (value: unknown): string => {
  if (Array.isArray(value) && value.length > 0) {
    return String(value[0])
  }
  if (value && typeof value === 'object') {
    const maybe = value as Record<string, unknown>
    const addresses = maybe.addresses
    if (Array.isArray(addresses) && addresses.length > 0) {
      return String(addresses[0])
    }
  }
  throw new Error('No addresses found in LocalNet wallet')
}

const getWalletId = (wallet: unknown): string => {
  if (!wallet || typeof wallet !== 'object') {
    throw new Error('Invalid KMD wallet payload')
  }
  const maybe = wallet as Record<string, unknown>
  const id = maybe.id
  if (typeof id !== 'string') {
    throw new Error('KMD wallet ID is missing')
  }
  return id
}

const makeKmdClient = (): algosdk.Kmd => {
  const config = getConfig()
  return new algosdk.Kmd(config.kmdToken, config.kmdServer, config.kmdPort)
}

const toSecretKey = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) {
    return value
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value)
  }
  if (value && typeof value === 'object') {
    const maybe = value as Record<string, unknown>
    const nested = maybe.private_key ?? maybe.privateKey
    if (nested instanceof Uint8Array) {
      return nested
    }
    if (Array.isArray(nested)) {
      return new Uint8Array(nested)
    }
  }
  throw new Error('Unable to extract secret key from KMD response')
}

const loadLocalnetAccount = async (): Promise<{ address: string; secretKey: Uint8Array }> => {
  const kmd = makeKmdClient()
  const wallets = await kmd.listWallets()
  const entries = Array.isArray(wallets)
    ? wallets
    : (wallets as { wallets?: unknown[] }).wallets ?? []
  const localWallet = entries.find((wallet) => {
    if (!wallet || typeof wallet !== 'object') {
      return false
    }
    return (wallet as Record<string, unknown>).name === LOCAL_WALLET_NAME
  })

  if (!localWallet) {
    throw new Error('LocalNet wallet not found. Run `algokit localnet start`.')
  }

  const handleRaw = await kmd.initWalletHandle(getWalletId(localWallet), '')
  const handle = toHandleToken(handleRaw)

  try {
    const keys = await kmd.listKeys(handle)
    const address = firstAddress(keys)
    const secretRaw = await kmd.exportKey(handle, '', address)
    const secretKey = toSecretKey(secretRaw)
    return { address, secretKey }
  } finally {
    await kmd.releaseWalletHandle(handle)
  }
}

const normalizeGroup = (txnGroup: TxInput[] | TxInput[][]): TxInput[] => {
  if (!Array.isArray(txnGroup)) {
    return []
  }
  if (txnGroup.length > 0 && Array.isArray(txnGroup[0])) {
    return txnGroup[0] as TxInput[]
  }
  return txnGroup as TxInput[]
}

const signTxnInput = (txn: TxInput, secretKey: Uint8Array): Uint8Array => {
  if (txn instanceof Uint8Array) {
    const decoded = algosdk.decodeUnsignedTransaction(txn)
    return decoded.signTxn(secretKey)
  }
  return txn.signTxn(secretKey)
}

const createCustomProvider = () => {
  let connected: WalletAccount | null = null

  const ensureConnected = async (): Promise<{ account: WalletAccount; secretKey: Uint8Array }> => {
    if (!connected) {
      const loaded = await loadLocalnetAccount()
      connected = {
        name: 'LocalNet Dev Account',
        address: loaded.address,
      }
      localStorage.setItem(CACHED_ADDRESS_KEY, loaded.address)
      return { account: connected, secretKey: loaded.secretKey }
    }

    const loaded = await loadLocalnetAccount()
    return { account: connected, secretKey: loaded.secretKey }
  }

  return {
    connect: async (): Promise<WalletAccount[]> => {
      const loaded = await loadLocalnetAccount()
      connected = {
        name: 'LocalNet Dev Account',
        address: loaded.address,
      }
      localStorage.setItem(CACHED_ADDRESS_KEY, loaded.address)
      return [connected]
    },

    disconnect: async (): Promise<void> => {
      connected = null
      localStorage.removeItem(CACHED_ADDRESS_KEY)
    },

    resumeSession: async (): Promise<WalletAccount[] | void> => {
      const cached = localStorage.getItem(CACHED_ADDRESS_KEY)
      if (!cached) {
        return
      }
      connected = {
        name: 'LocalNet Dev Account',
        address: cached,
      }
      return [connected]
    },

    signTransactions: async (
      txnGroup: TxInput[] | TxInput[][],
      indexesToSign?: number[],
    ): Promise<(Uint8Array | null)[]> => {
      const txns = normalizeGroup(txnGroup)
      const { secretKey } = await ensureConnected()
      const indexes = new Set(indexesToSign ?? txns.map((_, idx) => idx))
      return txns.map((txn, idx) => (indexes.has(idx) ? signTxnInput(txn, secretKey) : null))
    },

    transactionSigner: async (
      txnGroup: algosdk.Transaction[],
      indexesToSign: number[],
    ): Promise<Uint8Array[]> => {
      const { secretKey } = await ensureConnected()
      return indexesToSign.map((idx) => txnGroup[idx].signTxn(secretKey))
    },

    signData: async (data: string, metadata: SignMetadata): Promise<SignDataResponse> => {
      const { account, secretKey } = await ensureConnected()
      const bytes = fromStringToBytes(data)
      const signature = algosdk.signBytes(bytes, secretKey)
      return {
        data,
        signer: algosdk.decodeAddress(account.address).publicKey,
        domain: metadata.scope === ScopeType.AUTH ? 'algocampus-auth' : 'algocampus',
        authenticatorData: new Uint8Array(),
        signature,
      }
    },
  }
}

let managerInstance: WalletManager | null = null

export const getWalletManager = (): WalletManager => {
  if (managerInstance) {
    return managerInstance
  }

  const config = getConfig()
  const activeNetwork = config.algodNetwork || 'localnet'

  managerInstance = new WalletManager({
    wallets: [
      {
        id: WalletId.CUSTOM,
        options: {
          provider: createCustomProvider(),
        },
        metadata: {
          name: 'LocalNet Wallet',
          icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3QgeD0iNCIgeT0iMTIiIHdpZHRoPSI1NiIgaGVpZ2h0PSI0MCIgcng9IjgiIGZpbGw9IiMyYjRhNmYiLz48cmVjdCB4PSIxMCIgeT0iMjAiIHdpZHRoPSI0NCIgaGVpZ2h0PSIyNCIgcng9IjYiIGZpbGw9IiNlYWY2ZmYiLz48Y2lyY2xlIGN4PSI0NiIgY3k9IjMyIiByPSI0IiBmaWxsPSIjMTQzMDUwIi8+PC9zdmc+',
        },
      },
    ],
    defaultNetwork: activeNetwork,
    networks: {
      [activeNetwork]: {
        algod: {
          token: config.algodToken,
          baseServer: config.algodServer,
          port: config.algodPort,
        },
      },
    },
  })

  return managerInstance
}
