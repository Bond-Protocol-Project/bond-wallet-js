import { Address, Hex } from "viem";

export type SupportedChains = "avalanche_fuji" | "polygon_amoy" | "sepolia" | "arbitrum_sepolia" ;
export type SupportedTokens = "USDC";

export type UserOperationStruct = {
    sender: Address;                  // e.g., "0xabc...def"
    nonce: Hex;                    // Must be a bigint
    initCode: Hex;                    // 0x-prefixed hex string
    callData: Hex;
    callGasLimit: Hex;
    verificationGasLimit: Hex;
    preVerificationGas: Hex;
    maxFeePerGas: Hex;
    maxPriorityFeePerGas: Hex;
    paymasterAndData: Hex;
    signature: Hex;
};

export interface IntentDstData {
  target: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
}

export interface IntentDataInput {
  sender: `0x${string}`;
  initChainSenderNonce: bigint;
  initChainId: bigint;
  poolId: bigint;
  srcChainIds: bigint[];
  srcAmounts: bigint[];
  dstChainId: bigint;
  dstDatas: IntentDstData[];
  expires: bigint;
}

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}