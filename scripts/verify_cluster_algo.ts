import { analyzeBundleClusters } from '../src/services/bundleAnalyzer';
import { HeliusWalletData, FundingSource } from '../src/services/heliusService';

// Mock Funding Source
const funder: FundingSource = {
    address: 'Funder_Address_123',
    amount: 1000000000,
    timestamp: 1000,
    isCex: false
};

// Helper to create wallet
const createWallet = (id: string, group: string): HeliusWalletData => ({
    address: id,
    buys: [{ tokenAmount: 1000, timestamp: 2000 }],
    sells: [],
    outgoingTransfers: [],
    incomingTransfers: [],
    currentBalance: 1000,
    isSeedWallet: false,
    traceDepth: 1,
    fundingSource: funder
});

// SCENARIO: 
// Group A: A1 -> A2 -> A3
// Group B: B1 -> B2
// Both funded by 'Funder_Address_123'
// Should result in 2 clusters, NOT 1.

const wallets: HeliusWalletData[] = [
    createWallet('A1', 'A'),
    createWallet('A2', 'A'),
    createWallet('A3', 'A'),
    createWallet('B1', 'B'),
    createWallet('B2', 'B')
];

// Add connections
// A1 -> A2
wallets.find(w => w.address === 'A1')!.outgoingTransfers.push({ to: 'A2', tokenAmount: 10, timestamp: 2100 });
wallets.find(w => w.address === 'A2')!.incomingTransfers.push({ from: 'A1', tokenAmount: 10, timestamp: 2100 });

// A2 -> A3
wallets.find(w => w.address === 'A2')!.outgoingTransfers.push({ to: 'A3', tokenAmount: 10, timestamp: 2200 });
wallets.find(w => w.address === 'A3')!.incomingTransfers.push({ from: 'A2', tokenAmount: 10, timestamp: 2200 });

// B1 -> B2
wallets.find(w => w.address === 'B1')!.outgoingTransfers.push({ to: 'B2', tokenAmount: 10, timestamp: 2300 });
wallets.find(w => w.address === 'B2')!.incomingTransfers.push({ from: 'B1', tokenAmount: 10, timestamp: 2300 });


console.log('Running Cluster Analysis on Split Group Scenario...');
const result = analyzeBundleClusters(wallets, 10000, 1, 10000);

console.log(`\nTotal Clusters Found: ${result.clusterCount}`);
console.log('Clusters:');
result.clusters.forEach(c => {
    console.log(`- ${c.id}: ${c.wallets.length} wallets. Risk: ${c.risk}`);
    console.log(`  Members: ${c.wallets.map(w => w.address).join(', ')}`);
});

// Verification Logic
if (result.clusterCount === 2) {
    const ids = result.clusters.map(c => c.id);
    // Expect Cluster A and Cluster A-2 (or similar naming)
    console.log('\n✅ SUCCESS: Correctly identified 2 distinct clusters from single funding source.');
} else {
    console.log(`\n❌ TEMPORARY FAILURE: Expected 2 clusters, found ${result.clusterCount}. Logic needs review.`);
}

// SCENARIO 2: Dispersed Funding
// 12 Wallets, funded by same source, NO connections.
console.log('\nRunning Dispersed Funding Analysis...');
const dispersedWallets: HeliusWalletData[] = Array.from({ length: 12 }, (_, i) => createWallet(`D${i}`, 'D'));
const result2 = analyzeBundleClusters(dispersedWallets, 10000, 1, 10000);

console.log(`Total Clusters Found: ${result2.clusterCount}`);
result2.clusters.forEach(c => {
    console.log(`- ${c.id}: ${c.wallets.length} wallets. Status: ${c.status}`);
});

if (result2.clusterCount === 1) {
    console.log('✅ SUCCESS: Correctly identified Dispersed Funding group.');
} else {
    console.log(`❌ FAILURE: Expected 1 Dispersed group, found ${result2.clusterCount} (${result2.clusters[0]?.id})`);
}
