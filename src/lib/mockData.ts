export type RiskLevel = 'SAFE' | 'CAUTION' | 'DANGER' | 'CRITICAL';
export type ThreatType = 'ACCUMULATION_PHASE' | 'DISTRIBUTION_PHASE' | 'ORGANIC_GROWTH' | 'UNKNOWN';

export interface WalletNode {
    address: string;
    isBundler: boolean;
    fundingSource: string;
    holdingAmount: number;
    percentage: number;
}

export interface LiquidityPair {
    dexName: string; // e.g., 'Uniswap V2', 'SushiSwap', 'Raydium'
    liquidityUSD: number;
    pairAddress: string;
    baseTokenSymbol: string;
    quoteTokenSymbol: string;
}

/** A single wallet within a bundle cluster */
export interface BundleWallet {
    address: string;
    boughtAmount: number;      // tokens bought via swap
    receivedAmount: number;    // tokens received via transfer from other bundled wallets
    currentBalance: number;    // live token balance
    soldAmount: number;        // tokens sold via swap
    holdingUSD: number;        // currentBalance * priceUsd
    status: 'active' | 'dormant' | 'sold_all';
}

/** A cluster of related wallets under common control */
export interface BundleCluster {
    id: string;                // "Cluster A", "Cluster B", etc.
    wallets: BundleWallet[];
    totalSupplyPercent: number;
    totalValueUSD: number;
    status: string;            // "Unlocked & Active", "Dormant", etc.
    lpImpact: number;          // totalValueUSD / liquidityUSD
    risk: 'High' | 'Moderate' | 'Low';

    // Phase 3: Coordination Intelligence
    riskScore: number;         // 0-100
    riskFactors: string[];     // ["Shared Funding", "Temporal Match", "Internal Transfers", "Sync Sell"]
    internalTransferCount: number;
}
/** Result from the BundleAnalyzer service */
export interface BundleControlResult {
    clusters: BundleCluster[];
    overallRisk: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
    lpValueUSD: number;
    clusterCount: number;
    lpImpactRatio: number;
    totalBundledSupplyPercent: number;
    totalBundledTokens: number;
    totalBundledValueUSD: number;
    totalWalletCount: number;
    statusDistribution: {
        locked: number;
        burned: number;
        dormant: number;
        active: number;
    };
    lastUpdated: string;
}

export interface CoordinationAnalysis extends BundleControlResult {
    totalBundlePercentage: number;
    bundleWalletCount: number;
    holdingConcentration: number;
    liquidityMcapRatio: number;
    uniqueFundingSources: number;
    bundleHoldingsUSD: number;
    bundleVolumeUSD: number;
    liquidityRiskRatio: number;

    // FORENSIC METRICS (New)
    block0Volume: number;
    block1Volume: number;
    bribeFees: number; // ETH/SOL paid
    initialInsiderSupply: number;
    totalInsiderSold: number;
    currentInsiderHoldings: number;
    retentionRate: number; // 0 to 1
}

/** Top-level bundle control analysis (Legacy/Alias) */
export type BundleControlAnalysis = CoordinationAnalysis;
export type BundleAnalysis = CoordinationAnalysis;

export interface ScoreFactor {
    label: string;           // e.g. "Honeypot"
    impact: number;          // negative = penalty, positive = bonus (e.g. -25, +0)
    status: 'pass' | 'fail' | 'warn' | 'info';  // drives the color/icon
    detail: string;          // short explanation
}

export interface ScanResult {
    score: number;
    riskLevel: RiskLevel;
    threatType: ThreatType;
    forensicsStatus: 'SUCCESS' | 'MISSING_KEY' | 'NOT_SUPPORTED' | 'ERROR';
    scoreBreakdown: ScoreFactor[];
    analysis: CoordinationAnalysis;
    wallets: WalletNode[];
    pairs: LiquidityPair[];
    selectedPair: LiquidityPair;
    isBurned: boolean;
    isLocked: boolean;
    isSoledOld: boolean;
    marketCap: number;
    tokenName: string;
    tokenSymbol: string;
    priceUsd: number;
    chainId: string;
    bundleControl?: BundleControlResult; // Deep bundle analysis (Helius — Solana only)
}

// Scenario generators for demo and testing

const createMockCluster = (id: string, size: number, RISK: 'High' | 'Moderate' | 'Low', supplyPct: number): BundleCluster => ({
    id,
    wallets: Array.from({ length: size }).map((_, i) => ({
        address: `0x${id}Wallet${i}`,
        boughtAmount: 1000,
        receivedAmount: 0,
        currentBalance: 1000,
        soldAmount: 0,
        holdingUSD: 100,
        status: 'active'
    })),
    totalSupplyPercent: supplyPct,
    totalValueUSD: size * 100,
    status: 'Active',
    lpImpact: 0.5,
    risk: RISK,
    riskScore: RISK === 'High' ? 85 : (RISK === 'Moderate' ? 50 : 10),
    riskFactors: [],
    internalTransferCount: 0
});

export const MOCK_SCENARIOS: Record<string, ScanResult> = {
    SAFE: {
        score: 95,
        riskLevel: 'SAFE',
        threatType: 'ORGANIC_GROWTH',
        forensicsStatus: 'SUCCESS',
        scoreBreakdown: [],
        marketCap: 125000,
        tokenName: 'SafeToken',
        tokenSymbol: 'SAFE',
        priceUsd: 0.00125,
        chainId: 'ethereum',
        isBurned: true,
        isLocked: true,
        isSoledOld: false,
        pairs: [
            { dexName: 'Uniswap V2', liquidityUSD: 80000, pairAddress: '0xSafePair1', baseTokenSymbol: 'SAFE', quoteTokenSymbol: 'ETH' },
            { dexName: 'SushiSwap', liquidityUSD: 20000, pairAddress: '0xSafePair2', baseTokenSymbol: 'SAFE', quoteTokenSymbol: 'ETH' },
        ],
        selectedPair: { dexName: 'Uniswap V2', liquidityUSD: 80000, pairAddress: '0xSafePair1', baseTokenSymbol: 'SAFE', quoteTokenSymbol: 'ETH' },
        analysis: {
            overallRisk: 'LOW',
            clusters: [],
            lpValueUSD: 80000,
            clusterCount: 0,
            lpImpactRatio: 0,
            totalBundledSupplyPercent: 0,
            totalBundlePercentage: 5,
            bundleWalletCount: 0,
            holdingConcentration: 15,
            liquidityMcapRatio: 0.8,
            uniqueFundingSources: 50,
            bundleHoldingsUSD: 0,
            bundleVolumeUSD: 2500,
            liquidityRiskRatio: 0.0,

            // Derived UI fields
            totalBundledTokens: 0,
            totalBundledValueUSD: 0,
            totalWalletCount: 0,
            statusDistribution: { locked: 0, burned: 0, dormant: 0, active: 0 },
            lastUpdated: new Date().toISOString(),
            // Forensics
            block0Volume: 0,
            block1Volume: 200,
            bribeFees: 0.01,
            initialInsiderSupply: 2500,
            totalInsiderSold: 1000,
            currentInsiderHoldings: 1500,
            retentionRate: 0.6
        },
        wallets: [
            { address: "0x12..ab", isBundler: false, fundingSource: "Binance", holdingAmount: 1000, percentage: 1 },
            { address: "0x34..cd", isBundler: false, fundingSource: "Coinbase", holdingAmount: 900, percentage: 0.9 },
        ],
    },
    NEST: {
        score: 25,
        riskLevel: 'DANGER',
        threatType: 'ACCUMULATION_PHASE',
        forensicsStatus: 'SUCCESS',
        scoreBreakdown: [],
        marketCap: 200000,
        tokenName: 'NestToken',
        tokenSymbol: 'NEST',
        priceUsd: 0.002,
        chainId: 'ethereum',
        isBurned: false,
        isLocked: true,
        isSoledOld: false,
        pairs: [
            { dexName: 'Uniswap V2', liquidityUSD: 60000, pairAddress: '0xNestPair', baseTokenSymbol: 'NEST', quoteTokenSymbol: 'ETH' },
        ],
        selectedPair: { dexName: 'Uniswap V2', liquidityUSD: 60000, pairAddress: '0xNestPair', baseTokenSymbol: 'NEST', quoteTokenSymbol: 'ETH' },
        analysis: {
            overallRisk: 'HIGH',
            clusters: [
                { ...createMockCluster('Cluster A', 22, 'High', 15), riskScore: 85, riskFactors: ['Shared Funding', 'Temporal Match'], internalTransferCount: 5 },
                { ...createMockCluster('Cluster B', 18, 'Moderate', 8), riskScore: 45, riskFactors: ['Behavioral Match'], internalTransferCount: 1 }
            ],
            lpValueUSD: 60000,
            clusterCount: 2,
            lpImpactRatio: 1.5,
            totalBundledSupplyPercent: 45,
            totalBundlePercentage: 45,
            bundleWalletCount: 25,
            holdingConcentration: 70,
            liquidityMcapRatio: 0.3,
            uniqueFundingSources: 2,
            bundleHoldingsUSD: 90000,
            bundleVolumeUSD: 90000,
            liquidityRiskRatio: 1.5,

            // Derived UI fields
            totalBundledTokens: 45000,
            totalBundledValueUSD: 90000,
            totalWalletCount: 25,
            statusDistribution: { locked: 0, burned: 0, dormant: 5, active: 20 },
            lastUpdated: new Date().toISOString(),
            // Forensics
            block0Volume: 80000, // Heavy launch activity
            block1Volume: 10000,
            bribeFees: 5.4, // Elevated MEV priority fees
            initialInsiderSupply: 90000,
            totalInsiderSold: 0, // Full retention
            currentInsiderHoldings: 90000,
            retentionRate: 1.0
        },
        wallets: [
            { address: "0xBot..1", isBundler: true, fundingSource: "0xMixin", holdingAmount: 20000, percentage: 10 },
            { address: "0xBot..2", isBundler: true, fundingSource: "0xMixin", holdingAmount: 20000, percentage: 10 },
        ],
    },
    VAMPIRE: {
        score: 10,
        riskLevel: 'CRITICAL',
        threatType: 'DISTRIBUTION_PHASE',
        forensicsStatus: 'SUCCESS',
        scoreBreakdown: [],
        marketCap: 150000,
        tokenName: 'VampireToken',
        tokenSymbol: 'VAMP',
        priceUsd: 0.0015,
        chainId: 'ethereum',
        isBurned: false,
        isLocked: true,
        isSoledOld: false,
        pairs: [
            { dexName: 'Uniswap V2', liquidityUSD: 30000, pairAddress: '0xVampPair', baseTokenSymbol: 'VAMP', quoteTokenSymbol: 'ETH' },
        ],
        selectedPair: { dexName: 'Uniswap V2', liquidityUSD: 30000, pairAddress: '0xVampPair', baseTokenSymbol: 'VAMP', quoteTokenSymbol: 'ETH' },
        analysis: {
            overallRisk: 'CRITICAL',
            clusters: [
                { ...createMockCluster('Cluster A', 15, 'High', 60), riskScore: 95, riskFactors: ['Shared Funding', 'Sync Sell', 'Internal Transfers'], internalTransferCount: 12 }
            ],
            lpValueUSD: 30000,
            clusterCount: 1,
            lpImpactRatio: 1.3,
            totalBundledSupplyPercent: 60,
            totalBundlePercentage: 60,
            bundleWalletCount: 15,
            holdingConcentration: 40, // Declining due to active distribution
            liquidityMcapRatio: 0.2,
            uniqueFundingSources: 1,
            bundleHoldingsUSD: 40000,

            // Derived UI fields
            totalBundledTokens: 90000,
            totalBundledValueUSD: 135,
            totalWalletCount: 15,
            statusDistribution: { locked: 0, burned: 0, dormant: 0, active: 15 },
            lastUpdated: new Date().toISOString(),

            // Forensics
            bundleVolumeUSD: 90000,
            liquidityRiskRatio: 1.3,
            // Forensics
            block0Volume: 85000,
            block1Volume: 5000,
            bribeFees: 2.1,
            initialInsiderSupply: 90000,
            totalInsiderSold: 50000, // Over 50% distributed
            currentInsiderHoldings: 40000,
            retentionRate: 0.44
        },
        wallets: [
            { address: "0xVamp..1", isBundler: true, fundingSource: "0xCoord", holdingAmount: 10000, percentage: 6 },
        ],
    }
};

export const getMockResult = (query: string): ScanResult => {
    const normalizedQuery = query.toUpperCase();
    if (normalizedQuery === 'RUG') return MOCK_SCENARIOS['VAMPIRE']; // RUG maps to VAMPIRE scenario
    if (MOCK_SCENARIOS[normalizedQuery]) {
        return MOCK_SCENARIOS[normalizedQuery];
    }

    // Default fallback (Organic)
    return MOCK_SCENARIOS['SAFE'];
};
