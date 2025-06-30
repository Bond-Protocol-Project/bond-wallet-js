import { Hex } from "viem";

export const ENTRYPOINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
export const FACTORY_ADDRESS = "0x2DebAA8f9F2B53ceEc3662FdB4D2eDA58b132B6d";
export const PROTOCOL_ADDRESS = "0x1F4899e17F9eEc08B91a48f8A5be12Bca14F18a6";

// Supported chain IDs
export const SUPPORTED_CHAIN_IDS = [80002n, 11155111n, 421614n, 43113n];

export const supported_chain_data = {
    polygon_amoy: {
        pools: [
            {
                id: "100001",
                underlying_token: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as Hex
            }
        ]
    },
    sepolia: {
        pools: [
            {
                id: "100001",
                underlying_token: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Hex
            }
        ]
    },
    arbitrum_sepolia: {
        pools: [
            {
                id: "100001",
                underlying_token: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Hex
            }
        ]
    },
    avalanche_fuji: {
        pools: [
            {
                id: "100001",
                underlying_token: "0x5425890298aed601595a70AB815c96711a31Bc65" as Hex
            }
        ]
    }
}