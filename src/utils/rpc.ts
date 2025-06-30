/**
 * Returns the correct RPC URL based on chain ID
 */
export function getRpcUrl(chainId: number): string {
    switch (chainId) {
        case 421614: // Arbitrum sepolia
            return "https://arb-sepolia.g.alchemy.com/v2/m-5XfdCcVmgvaBrKpPrDddiSnz9cIxZP";
        case 80002: // Polygon amoy
            return "https://polygon-amoy.g.alchemy.com/v2/39z55O1uXN4WaPKiV-QVYoTOWikzQciv";
        case 11155111: // Ethereum sepolia
            return "https://eth-sepolia.g.alchemy.com/v2/SE-MFXtLZCCVRBDG93CdAL8G0CRwhkhZ"
        case 43113: // Avalanche fuji
            return "https://avax-fuji.g.alchemy.com/v2/PqvFXjZ-RMFxE9a-X51Q7fxxy8Tov1zz"
        default:
            throw new Error("Unsupported network. Please switch to Ethereum or Polygon.");
    }
}
