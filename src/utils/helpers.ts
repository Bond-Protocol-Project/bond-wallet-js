import { ethers } from "ethers";
import { decodeAbiParameters, Hex, pad } from "viem"
import { ENTRYPOINT_ADDRESS, supported_chain_data, SUPPORTED_CHAIN_IDS } from "./constants";
import { IntentDataInput, SupportedChains, SupportedTokens, UserOperationStruct, ValidationError, ValidationResult } from "../types/global.types";
import { encodeAbiParameters, parseAbiParameters, parseEther } from 'viem';

export function getDummySignatureByTotalSignersLength(signers_length: number): Hex {
    let _sig = "0x"
    for (let index = 0; index < signers_length; index++) {
        _sig += "fffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
    }
    return _sig as Hex;
};

export function toBytes32Salt(index: number): `0x${string}` {
    if (index < 0) throw new Error('Salt index must be non-negative');
    return pad(`0x${index.toString(16)}`, { size: 32 });
}

/**
 * Encodes IntentData struct to bytes for contract submission
 * @param intentData - The intent data object to encode
 * @returns Encoded bytes string
 */
export function encodeIntentData(intentData: IntentDataInput): `0x${string}` {
    // First, encode the dstDatas array (IntentDstData[])
    const dstDatasEncoded = encodeAbiParameters(
        parseAbiParameters('(address,uint256,bytes)[]'),
        [intentData.dstDatas.map(dst => [dst.target, dst.value, dst.data] as const)]
    );

    // Encode the complete IntentData struct
    const encodedIntentData = encodeAbiParameters(
        parseAbiParameters('(address,uint64,uint64,uint64,uint64[],uint256[],uint64,bytes,uint256)'),
        [[
            intentData.sender,
            intentData.initChainSenderNonce,
            intentData.initChainId,
            intentData.poolId,
            intentData.srcChainIds as readonly bigint[],
            intentData.srcAmounts as readonly bigint[],
            intentData.dstChainId,
            dstDatasEncoded,
            intentData.expires
        ] as const]
    );

    return encodedIntentData;
}

/**
 * Validates IntentData struct before encoding
 * @param intentData - The intent data object to validate
 * @returns Validation result with errors if any
 */
export function validateIntentData(intentData: IntentDataInput): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate sender address
    if (!intentData.sender || intentData.sender === '0x0000000000000000000000000000000000000000') {
        errors.push({
            field: 'sender',
            message: 'Sender must be a valid non-zero address'
        });
    }

    // Validate address format
    if (intentData.sender && !/^0x[a-fA-F0-9]{40}$/.test(intentData.sender)) {
        errors.push({
            field: 'sender',
            message: 'Sender must be a valid Ethereum address format'
        });
    }

    // Validate initChainId
    if (!SUPPORTED_CHAIN_IDS.includes(intentData.initChainId)) {
        errors.push({
            field: 'initChainId',
            message: `initChainId must be one of supported chains: ${SUPPORTED_CHAIN_IDS.join(', ')}`
        });
    }

    // Validate dstChainId
    if (!SUPPORTED_CHAIN_IDS.includes(intentData.dstChainId)) {
        errors.push({
            field: 'dstChainId',
            message: `dstChainId must be one of supported chains: ${SUPPORTED_CHAIN_IDS.join(', ')}`
        });
    }

    // Validate srcChainIds
    for (let i = 0; i < intentData.srcChainIds.length; i++) {
        if (!SUPPORTED_CHAIN_IDS.includes(intentData.srcChainIds[i])) {
            errors.push({
                field: `srcChainIds[${i}]`,
                message: `srcChainIds[${i}] must be one of supported chains: ${SUPPORTED_CHAIN_IDS.join(', ')}`
            });
        }
    }

    // Validate srcChainIds and srcAmounts length match
    if (intentData.srcChainIds.length !== intentData.srcAmounts.length) {
        errors.push({
            field: 'srcChainIds/srcAmounts',
            message: 'srcChainIds and srcAmounts arrays must have equal length'
        });
    }

    // Validate srcAmounts are positive
    for (let i = 0; i < intentData.srcAmounts.length; i++) {
        if (intentData.srcAmounts[i] <= 0n) {
            errors.push({
                field: `srcAmounts[${i}]`,
                message: `srcAmounts[${i}] must be greater than 0`
            });
        }
    }

    // Validate expires time (30 minutes to 2 hours in the future)
    const now = BigInt(Math.floor(Date.now() / 1000));
    const thirtyMinutes = 30n * 60n; // 30 minutes in seconds
    const twoHours = 2n * 60n * 60n; // 2 hours in seconds

    const minExpires = now + thirtyMinutes;
    const maxExpires = now + twoHours;

    if (intentData.expires < minExpires) {
        errors.push({
            field: 'expires',
            message: 'expires must be at least 30 minutes in the future'
        });
    }

    if (intentData.expires > maxExpires) {
        errors.push({
            field: 'expires',
            message: 'expires must be at most 2 hours in the future'
        });
    }

    // Validate destination data targets
    if (intentData.dstDatas.length === 0) {
        errors.push({
            field: 'dstDatas',
            message: 'dstDatas array cannot be empty'
        });
    }

    for (let i = 0; i < intentData.dstDatas.length; i++) {
        const dstData = intentData.dstDatas[i];

        // Validate target address
        if (!dstData.target || dstData.target === '0x0000000000000000000000000000000000000000') {
            errors.push({
                field: `dstDatas[${i}].target`,
                message: `dstDatas[${i}].target must be a valid non-zero address`
            });
        }

        // Validate target address format
        if (dstData.target && !/^0x[a-fA-F0-9]{40}$/.test(dstData.target)) {
            errors.push({
                field: `dstDatas[${i}].target`,
                message: `dstDatas[${i}].target must be a valid Ethereum address format`
            });
        }

        // Validate value is non-negative
        if (dstData.value < 0n) {
            errors.push({
                field: `dstDatas[${i}].value`,
                message: `dstDatas[${i}].value must be non-negative`
            });
        }

        // Validate data format
        if (dstData.data && !/^0x[a-fA-F0-9]*$/.test(dstData.data)) {
            errors.push({
                field: `dstDatas[${i}].data`,
                message: `dstDatas[${i}].data must be valid hex data`
            });
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// Helper function to decode IntentData (for testing/verification)
export function decodeIntentData(encodedData: `0x${string}`): any {

    const decoded = decodeAbiParameters(
        parseAbiParameters('(address sender, uint64 initChainSenderNonce, uint64 initChainId, uint64 poolId, uint64[] srcChainIds, uint256[] srcAmounts, uint64 dstChainId, bytes dstDatas, uint256 expires)'),
        encodedData
    );

    // Also decode the nested dstDatas
    const decodedDstDatas = decodeAbiParameters(
        parseAbiParameters('(address target, uint256 value, bytes data)[]'),
        decoded[0].dstDatas
    );

    return {
        sender: decoded[0].sender,
        initChainSenderNonce: decoded[0].initChainSenderNonce,
        initChainId: decoded[0].initChainId,
        poolId: decoded[0].poolId,
        srcChainIds: decoded[0].srcChainIds,
        srcAmounts: decoded[0].srcAmounts,
        dstChainId: decoded[0].dstChainId,
        dstDatas: decodedDstDatas[0].map((dst: any) => ({
            target: dst.target,
            value: dst.value,
            data: dst.data
        })),
        expires: decoded[0].expires
    };
}

export function getChainIdFromChainName(chainName: SupportedChains) {
    switch (chainName) {
        case "avalanche_fuji":
            return 43113;
            break;
        case "sepolia":
            return 11155111;
            break;
        case "polygon_amoy":
            return 80002;
            break;
        case "arbitrum_sepolia":
            return 421614;
            break;
        default:
            throw new Error("Unsupported network. Please switch to Ethereum or Polygon.");
            break;
    }
}

export function getChainNameFromChainId(chainId: number): SupportedChains {
    switch (chainId) {
        case 43113:
            return "avalanche_fuji";
            break;
        case 11155111:
            return "sepolia";
            break;
        case 80002:
            return "polygon_amoy";
            break;
        case 421614:
            return "arbitrum_sepolia";
            break;
        default:
            throw new Error("Unsupported network. Please switch to Ethereum or Polygon.");
            break;
    }
}

export function getPoolIdFromTokenName(tokenName: SupportedTokens) {
    switch (tokenName) {
        case "USDC":
            return 100001;
            break;
        default:
            throw new Error("Unsupported token");
            break;
    }
}

export function getUsdcAddressByChainName(chainName: SupportedChains): Hex {
    switch (chainName) {
        case "avalanche_fuji":
            return "0x5425890298aed601595a70AB815c96711a31Bc65";
            break;
        case "sepolia":
            return "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
            break;
        case "polygon_amoy":
            return "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
            break;
        case "arbitrum_sepolia":
            return "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
            break;
        default:
            throw new Error("Unsupported network. Please switch to Ethereum or Polygon.");
            break;
    }
}

export function getTokenFromChainNameAndTokenName(chainName: SupportedChains, tokenName: SupportedTokens) {
    const _pools = supported_chain_data[chainName].pools;
    const _poolId = getPoolIdFromTokenName(tokenName);
    const getPool = _pools.find((e) => e.id == _poolId.toString());
    if (!getPool) throw new Error("Unsupported chain and token combination");
    return getPool.underlying_token;
}

export function getProviderFromChainId(chainId: number) {
    switch (chainId) {
        case 11155111:
            return new ethers.JsonRpcProvider("https://api.pimlico.io/v2/11155111/rpc?apikey=pim_2rjGmDUvatAcb62Ash3BTo");
            break;
        case 80002:
            return new ethers.JsonRpcProvider("https://api.pimlico.io/v2/80002/rpc?apikey=pim_2rjGmDUvatAcb62Ash3BTo");
            break;
        case 421614:
            return new ethers.JsonRpcProvider("https://api.pimlico.io/v2/421614/rpc?apikey=pim_2rjGmDUvatAcb62Ash3BTo");
            break;
        case 43113:
            return new ethers.JsonRpcProvider("https://api.pimlico.io/v2/43113/rpc?apikey=pim_2rjGmDUvatAcb62Ash3BTo");
            break;
        default:
            throw new Error("Unsupported network. Please switch to Ethereum or Polygon.");
            break;
    }
}

export async function getPaymasterData(chainId: number, userOp: Partial<UserOperationStruct>): Promise<{
    paymasterAndData: Hex,
    preVerificationGas: Hex,
    verificationGasLimit: Hex,
    callGasLimit: Hex,
}> {
    const provider = getProviderFromChainId(chainId);
    const resp = await provider.send(
        "pm_sponsorUserOperation",
        [
            userOp,
            ENTRYPOINT_ADDRESS
        ]
    );

    return resp;
}

export async function getUserOpReceipt(
    chainId: number,
    userOpHash: string,
    retries = 5,
    sleepTime = 6
): Promise<any | null> {
    const pimlicoPublicClient = getProviderFromChainId(chainId);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${retries} to fetch receipt for ${userOpHash}`);

            const receipt = await pimlicoPublicClient.send("eth_getUserOperationReceipt", [userOpHash]);

            if (receipt !== null) {
                // console.log("Receipt found:", receipt.receipt);
                return receipt.receipt;
            }

            if (attempt < retries) {
                console.log(`Receipt not ready, waiting ${sleepTime}s before retry...`);
                await sleep(sleepTime);
            }

        } catch (error) {
            console.error(`Error on attempt ${attempt}:`, error);

            if (attempt < retries) {
                await sleep(sleepTime);
            }
        }
    }

    console.log("Max retries reached, returning null");
    return null;
}

export function sleep(seconds: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, seconds * 1000);
    });
}