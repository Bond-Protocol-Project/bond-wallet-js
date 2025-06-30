# Bond Wallet SDK Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [API Reference](#api-reference)
5. [Advanced Usage](#advanced-usage)
6. [Examples](#examples)
7. [Error Handling](#error-handling)
8. [TypeScript Support](#typescript-support)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

The Bond Wallet SDK is a TypeScript/JavaScript library that provides a simple and powerful interface to interact with Bond Protocol. It abstracts the complexity of cross-chain operations and ERC-4337 account abstraction, enabling developers to build seamless multi-chain applications.

### Key Features

- **Unified Balance Management**: View aggregated token balances across all supported chains
- **Cross-Chain Intents**: Create and execute cross-chain transactions with a single API call
- **Account Abstraction**: Full ERC-4337 support with gasless transactions
- **Smart Contract Interactions**: Simplified contract interaction utilities
- **TypeScript First**: Complete type safety and IntelliSense support
- **Multi-Chain Native**: Built from the ground up for multi-chain operations

### Supported Chains

- Ethereum Sepolia
- Polygon Amoy
- Avalanche Fuji
- Arbitrum Sepolia

### Supported Tokens

- USDC (Cross-chain compatible)
- Additional tokens can be added through the protocol's pool system

---

## Installation

### NPM

```bash
npm install bond-wallet-sdk
```

---

## Quick Start

### Basic Setup

```typescript
import { BondWallet } from "bond-wallet-js";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// Create wallet client (using viem)
const account = privateKeyToAccount("0x...");
const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http()
});

// Initialize Bond Wallet
const bondWallet = new BondWallet(walletClient);

// Get smart account address
const address = await bondWallet.getAddress();
console.log("Bond Smart Account:", address);
```

### Activate address

Before interacting with any chain you must activate your address. This will make your Bond experience smooth

```typescript
// Activate sepolia address, repeat this steap for other chains
const response = await bondWallet.activate("sepolia");
console.log(response);
```

### Your First Cross-Chain Intent

```typescript
// Check unified balance
const balance = await bondWallet.unifiedBalance("USDC");
console.log("Total USDC across all chains:", balance.balance);

// Create cross-chain intent
const intent = await bondWallet.intent.direct({
    token: "USDC",
    source: [
        { amount: "10", chain: "sepolia" },
        { amount: "5", chain: "polygon_amoy" }
    ],
    destChain: "avalanche_fuji",
    recipient: "0x742d35Cc6634C0532925a3b8D4B9f4B3D7b4bE4B",
    amount: "15"
});

// Execute the intent
const userOpHash = await intent.send();
console.log("Intent submitted:", userOpHash);
```

---

## API Reference

### BondWallet Class

#### Constructor

```typescript
constructor(walletClient: WalletClient)
```

**Parameters:**
- `walletClient`: A viem WalletClient instance

**Example:**
```typescript
const bondWallet = new BondWallet(walletClient);
```

#### Methods

##### `getAddress()`

Returns the Bond Smart Account address.

```typescript
async getAddress(): Promise<string>
```

**Returns:** `Promise<string>` - The smart account address

**Example:**
```typescript
const address = await bondWallet.getAddress();
console.log(address); // "0x..."
```

##### `unifiedBalance(token)`

Get unified token balance across all supported chains.

```typescript
async unifiedBalance(token: string): Promise<UnifiedBalanceResponse>
```

**Parameters:**
- `token`: Token symbol (e.g., "USDC")

**Returns:** `Promise<UnifiedBalanceResponse>`

```typescript
interface UnifiedBalanceResponse {
  balance: number;           // Total unified balance
  fragmented: Array<{        // Per-chain breakdown
    chain: string;
    balance: number;
  }>;
  chainBalance: number;      // Current chain balance
}
```

**Example:**
```typescript
const balance = await bondWallet.unifiedBalance("USDC");
console.log(`Total: ${balance.balance} USDC`);
console.log(`On current chain: ${balance.chainBalance} USDC`);

balance.fragmented.forEach(({ chain, balance }) => {
    console.log(`${chain}: ${balance} USDC`);
});
```

##### `sendUserOperation(params)`

Send a standard user operation (non-intent transaction).

```typescript
async sendUserOperation(params: UserOperationParams): Promise<string>
```

**Parameters:**
```typescript
interface UserOperationParams {
  to: string;           // Target contract address
  data: string;         // Encoded function data
  value?: bigint;       // ETH value (optional)
}
```

**Returns:** `Promise<string>` - User operation hash

**Example:**
```typescript
const userOpHash = await bondWallet.sendUserOperation({
    to: "0x...",
    data: "0x...",
    value: parseEther("0.1")
});
```

### Intent API

#### `bondWallet.intent.direct(params)`

Create a direct cross-chain intent.

```typescript
async direct(params: DirectIntentParams): Promise<Intent>
```

**Parameters:**
```typescript
interface DirectIntentParams {
  token: string;                    // Token symbol
  source: Array<{                   // Source chain configurations
    amount: string;                 // Amount on this chain
    chain: string;                  // Chain identifier
  }>;
  destChain: string;                // Destination chain
  recipient: string;                // Recipient address
  amount: string;                   // Total amount to send
}
```

**Returns:** `Promise<Intent>` - Intent object

**Example:**
```typescript
const intent = await bondWallet.intent.direct({
    token: "USDC",
    source: [
        { amount: "25", chain: "sepolia" },
        { amount: "25", chain: "polygon_amoy" }
    ],
    destChain: "avalanche_fuji",
    recipient: "0x742d35Cc6634C0532925a3b8D4B9f4B3D7b4bE4B",
    amount: "50"
});
```

### Intent Object

The Intent object returned by `intent.direct()` provides methods to interact with the created intent.

#### Properties

##### `data`

Get the raw encoded intent data.

```typescript
readonly data: string
```

**Example:**
```typescript
const intentData = intent.data;
console.log("Intent bytes:", intentData);
```

#### Methods

##### `getFees()`

Get fee estimate for executing the intent.

```typescript
async getFees(): Promise<bigint>
```

**Returns:** `Promise<bigint>` - Fee amount in token units

**Example:**
```typescript
const fees = await intent.getFees();
console.log(`Estimated fees: ${formatUnits(fees, 6)} USDC`);
```

##### `send()`

Execute the intent and submit it to the protocol.

```typescript
async send(): Promise<string>
```

**Returns:** `Promise<string>` - User operation hash

**Example:**
```typescript
try {
    const userOpHash = await intent.send();
    console.log("Intent submitted successfully:", userOpHash);
} catch (error) {
    console.error("Failed to send intent:", error);
}
```

### Utility Functions

#### `BondWallet.buildContract(params)`

Static utility function to encode contract function calls.

```typescript
static async buildContract(params: BuildContractParams): Promise<string>
```

**Parameters:**
```typescript
interface BuildContractParams {
  abi: any[];                    // Contract ABI
  functionName: string;          // Function name to call
  args: any[];                   // Function arguments
}
```

**Returns:** `Promise<string>` - Encoded function data

**Example:**
```typescript
const ERC20_ABI = [
    {
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    }
];

const data = await BondWallet.buildContract({
    abi: ERC20_ABI,
    functionName: "approve",
    args: ["0x742d35Cc6634C0532925a3b8D4B9f4B3D7b4bE4B", parseUnits("100", 6)]
});

await bondWallet.sendUserOperation({
    to: "0x...", // USDC token address
    data: data
});
```

---

## Advanced Usage

### Custom Chain Configuration

For advanced users who need to work with custom chain configurations:

```typescript
// Custom wallet client with specific chain
const customWalletClient = createWalletClient({
  account: privateKeyToAccount(privateKey),
  chain: {
    id: 11155111,
    name: 'Sepolia',
    network: 'sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: ['https://sepolia.infura.io/v3/YOUR_KEY'] },
      public: { http: ['https://sepolia.infura.io/v3/YOUR_KEY'] }
    }
  },
  transport: http()
});

const bondWallet = new BondWallet(customWalletClient);
```

### Batch Operations

```typescript
// Execute multiple operations in sequence
async function batchOperations() {
    // First approve token spending
    const approveData = await BondWallet.buildContract({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [PROTOCOL_ADDRESS, parseUnits("100", 6)]
    });
    
    await bondWallet.sendUserOperation({
        to: USDC_ADDRESS,
        data: approveData
    });
    
    // Then create and send intent
    const intent = await bondWallet.intent.direct({
        token: "USDC",
        source: [{ amount: "50", chain: "sepolia" }],
        destChain: "polygon_amoy",
        recipient: "0x...",
        amount: "50"
    });
    
    const userOpHash = await intent.send();
    return userOpHash;
}
```

### Fee Optimization

```typescript
// Check fees before execution
async function optimizedIntentExecution() {
    const intent = await bondWallet.intent.direct({
        token: "USDC",
        source: [
            { amount: "30", chain: "sepolia" },
            { amount: "20", chain: "polygon_amoy" }
        ],
        destChain: "avalanche_fuji",
        recipient: "0x...",
        amount: "50"
    });
    
    const estimatedFees = await intent.getFees();
    const feesInUSDC = Number(formatUnits(estimatedFees, 6));
    
    console.log(`Estimated fees: ${feesInUSDC} USDC`);
    
    // Only proceed if fees are reasonable
    if (feesInUSDC < 5) { // Less than $5 in fees
        return await intent.send();
    } else {
        throw new Error(`Fees too high: ${feesInUSDC} USDC`);
    }
}
```

---

## Examples

### Example 1: Simple Cross-Chain Transfer

```typescript
import { BondWallet } from "bond-wallet-js";
import { createWalletClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

async function simpleCrossChainTransfer() {
    // Setup
    const account = privateKeyToAccount(process.env.PRIVATE_KEY!);
    const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http()
    });
    
    const bondWallet = new BondWallet(walletClient);
    
    try {
        // Check balance
        const balance = await bondWallet.unifiedBalance("USDC");
        console.log("Available USDC:", balance.balance);
        
        if (balance.balance < 10) {
            throw new Error("Insufficient balance");
        }
        
        // Create intent
        const intent = await bondWallet.intent.direct({
            token: "USDC",
            source: [
                { amount: "10", chain: "sepolia" }
            ],
            destChain: "polygon_amoy",
            recipient: "0x742d35Cc6634C0532925a3b8D4B9f4B3D7b4bE4B",
            amount: "10"
        });
        
        // Check fees
        const fees = await intent.getFees();
        console.log("Fees:", formatUnits(fees, 6), "USDC");
        
        // Execute
        const userOpHash = await intent.send();
        console.log("Success! UserOp hash:", userOpHash);
        
    } catch (error) {
        console.error("Error:", error);
    }
}

simpleCrossChainTransfer();
```

### Example 2: Multi-Chain Aggregation

```typescript
async function multiChainAggregation() {
    const bondWallet = new BondWallet(walletClient);
    
    // Check fragmented balances
    const balance = await bondWallet.unifiedBalance("USDC");
    console.log("Fragmented balances:");
    balance.fragmented.forEach(({ chain, balance }) => {
        console.log(`  ${chain}: ${balance} USDC`);
    });
    
    // Aggregate from multiple chains
    const intent = await bondWallet.intent.direct({
        token: "USDC",
        source: [
            { amount: "15", chain: "sepolia" },
            { amount: "10", chain: "avalanche_fuji" },
            { amount: "25", chain: "arbitrum_sepolia" }
        ],
        destChain: "polygon_amoy",
        recipient: "0x742d35Cc6634C0532925a3b8D4B9f4B3D7b4bE4B",
        amount: "50"
    });
    
    console.log("Intent data:", intent.data);
    
    const userOpHash = await intent.send();
    console.log("Multi-chain aggregation completed:", userOpHash);
}
```

### Example 3: DeFi Integration

```typescript
async function defiIntegration() {
    const bondWallet = new BondWallet(walletClient);
    
    // First, aggregate liquidity to the DeFi protocol's chain
    const aggregationIntent = await bondWallet.intent.direct({
        token: "USDC",
        source: [
            { amount: "50", chain: "sepolia" },
            { amount: "30", chain: "polygon_amoy" }
        ],
        destChain: "avalanche_fuji", // DeFi protocol is on Avalanche
        recipient: await bondWallet.getAddress(), // Send to self
        amount: "80"
    });
    
    await aggregationIntent.send();
    
    // Wait for settlement (in real app, you'd monitor the transaction)
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
    
    // Then interact with DeFi protocol
    const stakeData = await BondWallet.buildContract({
        abi: STAKING_CONTRACT_ABI,
        functionName: "stake",
        args: [parseUnits("80", 6)]
    });
    
    await bondWallet.sendUserOperation({
        to: STAKING_CONTRACT_ADDRESS,
        data: stakeData
    });
    
    console.log("Successfully aggregated and staked tokens!");
}
```

### Example 4: Portfolio Rebalancing

```typescript
async function portfolioRebalancing() {
    const bondWallet = new BondWallet(walletClient);
    
    // Get current portfolio distribution
    const balance = await bondWallet.unifiedBalance("USDC");
    
    // Define target allocation (40% on Polygon, 30% on Arbitrum, 30% on Avalanche)
    const totalBalance = balance.balance;
    const targetAllocations = {
        "polygon_amoy": totalBalance * 0.4,
        "arbitrum_sepolia": totalBalance * 0.3,
        "avalanche_fuji": totalBalance * 0.3
    };
    
    // Calculate rebalancing needs
    const rebalanceIntents = [];
    
    for (const [targetChain, targetAmount] of Object.entries(targetAllocations)) {
        const currentAmount = balance.fragmented.find(
            f => f.chain === targetChain
        )?.balance || 0;
        
        const deficit = targetAmount - currentAmount;
        
        if (deficit > 1) { // Only rebalance if deficit > 1 USDC
            // Find source chains with excess
            const sources = balance.fragmented
                .filter(f => f.chain !== targetChain && f.balance > deficit)
                .slice(0, 2) // Max 2 sources
                .map(f => ({
                    amount: Math.min(f.balance, deficit / 2).toString(),
                    chain: f.chain
                }));
            
            if (sources.length > 0) {
                const intent = await bondWallet.intent.direct({
                    token: "USDC",
                    source: sources,
                    destChain: targetChain,
                    recipient: await bondWallet.getAddress(),
                    amount: sources.reduce((sum, s) => sum + parseFloat(s.amount), 0).toString()
                });
                
                rebalanceIntents.push(intent);
            }
        }
    }
    
    // Execute all rebalancing intents
    const results = await Promise.all(
        rebalanceIntents.map(intent => intent.send())
    );
    
    console.log(`Executed ${results.length} rebalancing intents:`, results);
}
```

---

## Error Handling

### Common Error Types

```typescript
// Network errors
try {
    const balance = await bondWallet.unifiedBalance("USDC");
} catch (error) {
    if (error.code === 'NETWORK_ERROR') {
        console.error("Network connection failed:", error.message);
    }
}

// Invalid parameters
try {
    const intent = await bondWallet.intent.direct({
        token: "INVALID_TOKEN",
        source: [{ amount: "10", chain: "invalid_chain" }],
        destChain: "sepolia",
        recipient: "0x...",
        amount: "10"
    });
} catch (error) {
    if (error.code === 'INVALID_PARAMETER') {
        console.error("Invalid parameter:", error.message);
    }
}

// Insufficient funds
try {
    const userOpHash = await intent.send();
} catch (error) {
    if (error.code === 'INSUFFICIENT_FUNDS') {
        console.error("Not enough tokens or gas:", error.message);
    }
}
```

### Best Practices for Error Handling

```typescript
async function robustIntentExecution(intentParams) {
    const MAX_RETRIES = 3;
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
        try {
            // Check balance first
            const balance = await bondWallet.unifiedBalance(intentParams.token);
            const requiredAmount = parseFloat(intentParams.amount);
            
            if (balance.balance < requiredAmount) {
                throw new Error(`Insufficient balance: need ${requiredAmount}, have ${balance.balance}`);
            }
            
            // Create intent
            const intent = await bondWallet.intent.direct(intentParams);
            
            // Check fees
            const fees = await intent.getFees();
            const feesInToken = Number(formatUnits(fees, 6));
            
            if (feesInToken > requiredAmount * 0.1) { // Fees > 10% of amount
                throw new Error(`Fees too high: ${feesInToken} ${intentParams.token}`);
            }
            
            // Execute
            const userOpHash = await intent.send();
            console.log("Intent executed successfully:", userOpHash);
            return userOpHash;
            
        } catch (error) {
            retries++;
            console.error(`Attempt ${retries} failed:`, error.message);
            
            if (retries < MAX_RETRIES) {
                // Exponential backoff
                await new Promise(resolve => 
                    setTimeout(resolve, Math.pow(2, retries) * 1000)
                );
            } else {
                throw error;
            }
        }
    }
}
```

---

## TypeScript Support

The SDK is built with TypeScript and provides comprehensive type definitions.

### Type Definitions

```typescript
// Import types
import { 
    BondWallet, 
    UnifiedBalanceResponse, 
    DirectIntentParams,
    Intent,
    UserOperationParams,
    BuildContractParams 
} from "bond-wallet-js";

// Type-safe usage
const balance: UnifiedBalanceResponse = await bondWallet.unifiedBalance("USDC");

const intentParams: DirectIntentParams = {
    token: "USDC",
    source: [{ amount: "10", chain: "sepolia" }],
    destChain: "polygon_amoy",
    recipient: "0x...",
    amount: "10"
};

const intent: Intent = await bondWallet.intent.direct(intentParams);
```

### Generic Types

```typescript
// Custom token type
type SupportedToken = "USDC" | "USDT" | "DAI";

// Custom chain type
type SupportedChain = "sepolia" | "polygon_amoy" | "avalanche_fuji" | "arbitrum_sepolia";

// Type-safe helper function
async function createTypedIntent<T extends SupportedToken>(
    token: T,
    amount: string,
    recipient: string
): Promise<Intent> {
    return bondWallet.intent.direct({
        token,
        source: [{ amount, chain: "sepolia" }],
        destChain: "polygon_amoy",
        recipient,
        amount
    });
}
```

---

## Best Practices

### 1. Balance Checking

Always check balances before creating intents:

```typescript
async function safeIntentCreation(params: DirectIntentParams) {
    const balance = await bondWallet.unifiedBalance(params.token);
    const requiredAmount = parseFloat(params.amount);
    
    if (balance.balance < requiredAmount) {
        throw new Error(`Insufficient balance: ${balance.balance} < ${requiredAmount}`);
    }
    
    return bondWallet.intent.direct(params);
}
```

### 2. Fee Estimation

Always estimate fees before execution:

```typescript
async function feeAwareExecution(intent: Intent) {
    const fees = await intent.getFees();
    const feesInUSDC = Number(formatUnits(fees, 6));
    
    console.log(`Estimated fees: $${feesInUSDC}`);
    
    // Only proceed if fees are reasonable
    if (feesInUSDC > 10) {
        throw new Error("Fees too high");
    }
    
    return intent.send();
}
```

### 3. Error Recovery

Implement proper error recovery:

```typescript
async function resilientExecution(params: DirectIntentParams) {
    try {
        const intent = await bondWallet.intent.direct(params);
        return await intent.send();
    } catch (error) {
        // Log error for debugging
        console.error("Intent execution failed:", error);
        
        // Try alternative approach
        if (error.code === 'INSUFFICIENT_LIQUIDITY') {
            // Maybe try with different source chains
            const alternativeParams = { ...params };
            // Modify params...
            return bondWallet.intent.direct(alternativeParams);
        }
        
        throw error;
    }
}
```

### 4. Connection Management

Properly manage wallet connections:

```typescript
class BondWalletManager {
    private bondWallet: BondWallet | null = null;
    
    async connect(walletClient: WalletClient) {
        this.bondWallet = new BondWallet(walletClient);
        
        // Verify connection
        try {
            await this.bondWallet.getAddress();
            console.log("Connected to Bond Protocol");
        } catch (error) {
            this.bondWallet = null;
            throw new Error("Failed to connect to Bond Protocol");
        }
    }
    
    async disconnect() {
        this.bondWallet = null;
    }
    
    get wallet() {
        if (!this.bondWallet) {
            throw new Error("Not connected to Bond Protocol");
        }
        return this.bondWallet;
    }
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid chain configuration"

**Problem**: Wallet client configured with unsupported chain.

**Solution**:
```typescript
// Ensure you're using supported chains
const supportedChains = {
    sepolia: 11155111,
    polygon_amoy: 80002,
    avalanche_fuji: 43113,
    arbitrum_sepolia: 421614
};

// Use correct chain configuration
const walletClient = createWalletClient({
    account,
    chain: sepolia, // Use viem's chain constants
    transport: http()
});
```

#### 2. "Insufficient allowance"

**Problem**: Token not approved for spending.

**Solution**:
```typescript
// Approve token spending first
const approveData = await BondWallet.buildContract({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [PROTOCOL_ADDRESS, parseUnits("1000", 6)] // Approve large amount
});

await bondWallet.sendUserOperation({
    to: USDC_TOKEN_ADDRESS,
    data: approveData
});
```

#### 3. "Intent execution timeout"

**Problem**: Intent taking too long to execute.

**Solution**:
```typescript
// Monitor intent status
async function monitorIntent(userOpHash: string) {
    const MAX_WAIT_TIME = 5 * 60 * 1000; // 5 minutes
    const start = Date.now();
    
    while (Date.now() - start < MAX_WAIT_TIME) {
        // Check if intent has been executed
        // Implementation depends on your monitoring setup
        
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    }
    
    throw new Error("Intent execution timeout");
}
```

#### 4. "Network connection errors"

**Problem**: RPC connection issues.

**Solution**:
```typescript
// Use multiple RPC endpoints
const walletClient = createWalletClient({
    account,
    chain: {
        ...sepolia,
        rpcUrls: {
            default: { 
                http: [
                    'https://sepolia.infura.io/v3/YOUR_KEY',
                    'https://sepolia.alchemy.com/v2/YOUR_KEY',
                    'https://rpc.sepolia.org'
                ]
            }
        }
    },
    transport: http()
});
```

### Debug Mode

Enable debug logging:

```typescript
// Set environment variable
process.env.BOND_DEBUG = "true";

// Or enable programmatically
BondWallet.setDebugMode(true);
```

### Getting Help

- **Documentation**: Check this documentation first
- **GitHub Issues**: Report bugs and request features
- **Discord**: Join the community for support
- **Stack Overflow**: Tag questions with `bond-protocol`

---

## Migration Guide

### From v1.x to v2.x

```typescript
// v1.x (deprecated)
const balance = await bondWallet.getBalance("USDC");

// v2.x (current)
const balance = await bondWallet.unifiedBalance("USDC");
```

### Breaking Changes

- `getBalance()` → `unifiedBalance()`
- Intent creation now requires explicit chain specification
- Fee estimation API changed to return `bigint` instead of `string`

---

## Contributing

We welcome contributions to the Bond Wallet SDK!

### Development Setup

```bash
git clone https://github.com/bond-protocol/bond-wallet-js
cd bond-wallet-js
npm install
npm run build
npm test
```

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires testnet funds)
npm run test:integration

# All tests
npm test
```

---

## License

MIT License - see LICENSE file for details.

---

## Changelog

### v2.1.0
- Added TypeScript strict mode support
- Improved error handling and messages
- Added batch operation utilities
- Performance optimizations

### v2.0.0
- Breaking: Renamed `getBalance()` to `unifiedBalance()`
- Added multi-chain intent support
- Improved fee estimation accuracy
- Added comprehensive TypeScript types

### v1.0.0
- Initial release
- Basic cross-chain intent functionality
- ERC-4337 account abstraction support

---

*Bond Wallet SDK - Simplifying Cross-Chain Development*