import { ScanResult } from './mockData';

export const analyzeTokenScore = (data: ScanResult): { score: number; details: string[] } => {
    // Use the engine's pre-calculated score — do NOT recalculate
    let score = data.score;
    const details: string[] = [];

    // --- DESCRIBE the score factors (explanations only, no score changes) ---

    // Threat Classification
    if (data.threatType === 'ACCUMULATION_PHASE') {
        details.push(`🚨 THREAT: Bundle Nest detected (Accumulation Phase)`);
        if (data.analysis.retentionRate > 0) {
            details.push(`⚠️ Insiders hold ${(data.analysis.retentionRate * 100).toFixed(0)}% of their initial bag.`);
        }
    } else if (data.threatType === 'DISTRIBUTION_PHASE') {
        details.push(`🚨 THREAT: Vampire Attack detected (Distribution Phase)`);
        if (data.analysis.totalInsiderSold > 0) {
            details.push(`⚠️ Insiders sold $${data.analysis.totalInsiderSold.toLocaleString()} (Realized Profit).`);
        }
    } else if (data.threatType === 'ORGANIC_GROWTH') {
        details.push(`✅ No bundle nest or distribution attack detected.`);
    }

    // Pair Quality
    if (data.pairs.length > 1) {
        details.push(`ℹ️ Analyzed highest liquidity pair: ${data.selectedPair.dexName} ($${data.selectedPair.liquidityUSD.toLocaleString()})`);
    }

    // Forensics
    if (data.analysis.block0Volume > 10000) {
        details.push(`⚠️ Heavy Launch Volume ($${data.analysis.block0Volume.toLocaleString()}).`);
    } else if (data.analysis.block0Volume > 0) {
        details.push(`ℹ️ Launch Volume: $${data.analysis.block0Volume.toLocaleString()}`);
    }

    if (data.analysis.bundleWalletCount > 0) {
        details.push(`⚠️ ${data.analysis.bundleWalletCount} bundled wallet${data.analysis.bundleWalletCount > 1 ? 's' : ''} detected at launch.`);
    }

    // Liquidity
    const safeLiquidity = data.selectedPair.liquidityUSD > 0 ? data.selectedPair.liquidityUSD : 1;
    const liquidityRatio = safeLiquidity / (data.marketCap || 1);
    if (liquidityRatio < 0.05) {
        details.push(`⚠️ Very thin liquidity relative to market cap (${(liquidityRatio * 100).toFixed(1)}%).`);
    }

    // Security
    if (data.isLocked) {
        details.push(`✅ Contract is open-source / verified.`);
    }
    if (data.isBurned) {
        details.push(`✅ Token is non-mintable (supply is fixed).`);
    }

    // Holder Concentration
    if (data.analysis.holdingConcentration > 60) {
        details.push(`⚠️ Top holders control ${data.analysis.holdingConcentration.toFixed(1)}% of supply.`);
    }

    return { score, details };
};

export const getRiskColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
}

export const getRiskLabel = (score: number) => {
    if (score >= 80) return "SAFE";
    if (score >= 50) return "CAUTION";
    if (score >= 20) return "DANGER";
    return "CRITICAL";
}
