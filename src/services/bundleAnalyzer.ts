import { HeliusWalletData } from './heliusService';
import { BundleControlResult, BundleCluster, BundleWallet } from '../lib/mockData';

/**
 * Main forensic engine for detecting bundled wallet clusters.
 * Orchestrates multiple heuristics: Funding, Temporal, Behavioral, and Internal Transfers.
 */
export function analyzeBundleClusters(
    wallets: HeliusWalletData[],
    totalSupply: number,
    _priceUsd: number, // Leading underscore for unused
    liquidityUsd: number,
    _block0Addresses: string[] = [],
    _holders: any[] = [],
    _block0BuyMapByHash: Map<string, number> = new Map()
): BundleControlResult {
    // 1. Initial clustering by heuristics
    let clusters: BundleCluster[] = [];
    const priceUsd = _priceUsd;
    
    // Group A: Shared Funding Sources
    const fundingMap = new Map<string, HeliusWalletData[]>();
    wallets.forEach(w => {
        if (w.fundingSource && !w.fundingSource.isCex) {
            const list = fundingMap.get(w.fundingSource.address) || [];
            list.push(w);
            fundingMap.set(w.fundingSource.address, list);
        }
    });

    fundingMap.forEach((members, funder) => {
        if (members.length > 1) {
            clusters.push(createCluster(`Funding Cluster (${funder.slice(0, 4)})`, members, priceUsd, liquidityUsd, totalSupply, ['Shared Funding']));
        }
    });

    // Group B: Temporal Proximity (Shotgun Buys)
    const timeGroups = new Map<number, HeliusWalletData[]>();
    wallets.forEach(w => {
        w.buys.forEach(buy => {
            const roundedTime = Math.floor(buy.timestamp / 2); // 2-second buckets
            const list = timeGroups.get(roundedTime) || [];
            list.push(w);
            timeGroups.set(roundedTime, list);
        });
    });

    timeGroups.forEach((members, time) => {
        const uniqueMembers = Array.from(new Set(members));
        if (uniqueMembers.length >= 3) {
            clusters.push(createCluster(`Temporal Cluster (${time})`, uniqueMembers, priceUsd, liquidityUsd, totalSupply, ['Temporal Match']));
        }
    });

    // Group C: Internal Transfers (Rings and Webs)
    const walletMap = new Map<string, HeliusWalletData>(wallets.map(w => [w.address, w]));
    const visited = new Set<string>();

    wallets.forEach(w => {
        if (!visited.has(w.address) && w.outgoingTransfers.length > 0) {
            const group: HeliusWalletData[] = [];
            const queue = [w];
            visited.add(w.address);

            while (queue.length > 0) {
                const current = queue.shift()!;
                group.push(current);
                
                const related = [
                    ...current.outgoingTransfers.map(t => t.to),
                    ...current.incomingTransfers.map(t => t.from)
                ];

                related.forEach(addr => {
                    if (!visited.has(addr) && walletMap.has(addr)) {
                        visited.add(addr);
                        queue.push(walletMap.get(addr)!);
                    }
                });
            }

            if (group.length > 1) {
                clusters.push(createCluster(`Network Cluster`, group, priceUsd, liquidityUsd, totalSupply, ['Internal Transfers']));
            }
        }
    });

    // 2. Merge overlapping clusters
    const mergedClusters = mergeClusters(clusters, priceUsd, liquidityUsd, totalSupply);

    // 3. Final refinement and scoring
    const finalClusters = mergedClusters.map(c => refineCluster(c, wallets, priceUsd, liquidityUsd));

    // 4. Global aggregation
    const totalBundledValueUSD = finalClusters.reduce((sum, c) => sum + c.totalValueUSD, 0);
    const totalBundledSupplyPercent = finalClusters.reduce((sum, c) => sum + c.totalSupplyPercent, 0);
    const totalWalletCount = new Set(finalClusters.flatMap(c => c.wallets.map(w => w.address))).size;

    const lpImpactRatio = liquidityUsd > 0 ? totalBundledValueUSD / liquidityUsd : 0;

    const statusDistribution = { locked: 0, burned: 0, dormant: 0, active: 0 };
    finalClusters.flatMap(c => c.wallets).forEach(w => {
        if (w.status === 'active') statusDistribution.active++;
        else if (w.status === 'dormant') statusDistribution.dormant++;
    });

    return {
        clusters: finalClusters,
        overallRisk: calculateOverallRisk(lpImpactRatio, totalBundledSupplyPercent),
        lpValueUSD: liquidityUsd,
        clusterCount: finalClusters.length,
        lpImpactRatio: parseFloat(lpImpactRatio.toFixed(2)),
        totalBundledSupplyPercent: parseFloat(totalBundledSupplyPercent.toFixed(2)),
        totalBundledTokens: (totalBundledSupplyPercent * totalSupply) / 100,
        totalBundledValueUSD,
        totalWalletCount,
        statusDistribution,
        lastUpdated: new Date().toISOString()
    };
}

function createCluster(id: string, members: HeliusWalletData[], priceUsd: number, liquidityUsd: number, totalSupply: number, factors: string[]): BundleCluster {
    const bundleWallets: BundleWallet[] = members.map(w => ({
        address: w.address,
        boughtAmount: w.buys.reduce((sum, b) => sum + b.tokenAmount, 0),
        receivedAmount: w.incomingTransfers.reduce((sum, t) => sum + t.tokenAmount, 0),
        currentBalance: w.currentBalance,
        soldAmount: w.sells.reduce((sum, s) => sum + s.tokenAmount, 0),
        holdingUSD: w.currentBalance * priceUsd,
        status: (w.currentBalance > 0) ? 'active' : 'sold_all'
    }));

    const totalValueUSD = bundleWallets.reduce((sum, w) => sum + w.holdingUSD, 0);
    const totalSupplyPercent = (bundleWallets.reduce((sum, w) => sum + w.currentBalance, 0) / totalSupply) * 100;

    return {
        id,
        wallets: bundleWallets,
        totalSupplyPercent,
        totalValueUSD,
        status: 'Active',
        lpImpact: liquidityUsd > 0 ? totalValueUSD / liquidityUsd : 0,
        risk: 'Low',
        riskScore: 0,
        riskFactors: factors,
        internalTransferCount: 0
    };
}

function mergeClusters(clusters: BundleCluster[], priceUsd: number, liquidityUsd: number, totalSupply: number): BundleCluster[] {
    const merged: BundleCluster[] = [];
    const used = new Set<number>();

    for (let i = 0; i < clusters.length; i++) {
        if (used.has(i)) continue;
        let current = clusters[i];
        used.add(i);

        for (let j = i + 1; j < clusters.length; j++) {
            if (used.has(j)) continue;
            
            const hasOverlap = current.wallets.some(w1 => 
                clusters[j].wallets.some(w2 => w1.address === w2.address)
            );

            if (hasOverlap) {
                const allWallets = [...current.wallets, ...clusters[j].wallets];
                const uniqueWallets = Array.from(new Map(allWallets.map(w => [w.address, w])).values());
                const allFactors = Array.from(new Set([...current.riskFactors, ...clusters[j].riskFactors]));
                
                current = {
                    ...current,
                    wallets: uniqueWallets,
                    riskFactors: allFactors,
                    totalValueUSD: uniqueWallets.reduce((sum, w) => sum + w.holdingUSD, 0),
                    totalSupplyPercent: (uniqueWallets.reduce((sum, w) => sum + w.currentBalance, 0) / totalSupply) * 100,
                    lpImpact: (uniqueWallets.reduce((sum, w) => sum + w.holdingUSD, 0)) / liquidityUsd
                };
                used.add(j);
                j = i; 
            }
        }
        merged.push(current);
    }
    return merged;
}

function refineCluster(cluster: BundleCluster, allWallets: HeliusWalletData[], _priceUsd: number, liquidityUsd: number): BundleCluster {
    let score = 0;
    const factors = [...cluster.riskFactors];

    if (factors.includes('Shared Funding')) score += 35;
    if (factors.includes('Temporal Match')) score += 30;
    if (factors.includes('Internal Transfers')) score += 25;

    const walletMap = new Map(allWallets.map(w => [w.address, w]));
    const clusterWallets = cluster.wallets.map(w => walletMap.get(w.address)).filter(Boolean) as HeliusWalletData[];
    
    let hasSyncSell = false;
    const sellTimes = clusterWallets.flatMap(w => w.sells.map(s => s.timestamp));
    if (sellTimes.length >= 2) {
        const sorted = sellTimes.sort((a, b) => a - b);
        for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i + 1] - sorted[i] <= 60) {
                hasSyncSell = true;
                break;
            }
        }
    }

    if (hasSyncSell && !factors.includes('Sync Sell')) {
        score += 40;
        factors.push('Sync Sell');
    }

    score = Math.min(score, 100);
    
    return {
        ...cluster,
        riskScore: score,
        risk: score > 70 ? 'High' : score > 30 ? 'Moderate' : 'Low',
        riskFactors: factors,
        lpImpact: parseFloat((cluster.totalValueUSD / liquidityUsd).toFixed(2)) || 0
    };
}

function calculateOverallRisk(impact: number, supply: number): 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' {
    if (impact > 1.0 || supply > 40) return 'CRITICAL';
    if (impact > 0.5 || supply > 20) return 'HIGH';
    if (impact > 0.2 || supply > 10) return 'MODERATE';
    return 'LOW';
}
