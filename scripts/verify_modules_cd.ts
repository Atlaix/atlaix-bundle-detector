import { analyzeBundleClusters } from '../src/services/bundleAnalyzer';
import { HeliusWalletData } from '../src/services/heliusService';

// ─── SYNTHETIC DATA GENERATOR ───

// 1. Create a "Clone Army" that also passes funds internally (Module C)
const createBotnet = (): HeliusWalletData[] => {
    const wallets: HeliusWalletData[] = [];
    const funder = 'FunderAddress123';

    // Create 10 bots
    for (let i = 0; i < 10; i++) {
        const address = `BotWallet_${i}`;
        const nextBot = `BotWallet_${(i + 1) % 10}`; // Ring formation

        wallets.push({
            address,
            buys: [{ tokenAmount: 1000, timestamp: 1000000 }], // Same time (Temporal)
            sells: [{ tokenAmount: 1000, timestamp: 1000060 }], // Same time + 60s (Sync Sell - Module D)
            outgoingTransfers: [
                { to: nextBot, tokenAmount: 50, timestamp: 1000050 } // Internal Transfer (Module C)
            ],
            incomingTransfers: [],
            currentBalance: 0,
            isSeedWallet: true,
            traceDepth: 1,
            fundingSource: { address: funder, amount: 1, timestamp: 999999, isCex: false }
        });
    }
    return wallets;
};

// 2. Create Organic Wallets (Control Group)
const createOrganic = (): HeliusWalletData[] => {
    const wallets: HeliusWalletData[] = [];
    for (let i = 0; i < 10; i++) {
        wallets.push({
            address: `OrganicUser_${i}`,
            buys: [{ tokenAmount: Math.random() * 1000, timestamp: 1000000 + i * 100 }], // Random times
            sells: [],
            outgoingTransfers: [],
            incomingTransfers: [],
            currentBalance: 100,
            isSeedWallet: false,
            traceDepth: 0
        });
    }
    return wallets;
};

// ─── RUN TEST ───

const main = () => {
    console.log('[TEST] Generating Synthetic Data...');
    const bots = createBotnet();
    const organic = createOrganic();
    const allWallets = [...bots, ...organic];

    console.log(`[TEST] Analyzing ${allWallets.length} wallets...`);

    // Run Analysis
    const result = analyzeBundleClusters(allWallets, 1000000, 1, 100000);

    console.log('\n─── RESULTS ───');
    console.log(`Clusters Found: ${result.clusterCount}`);
    console.log(`Risk Level: ${result.overallRisk}`);

    result.clusters.forEach(c => {
        console.log(`\n[CLUSTER: ${c.id}]`);
        console.log(`Size: ${c.wallets.length}`);
        console.log(`Risk Score: ${c.risk}`); // Note: BundleCluster interface has 'High'|'Moderate'|'Low', need to check mapping
    });

    // Check Metrics (Manual inspection of logic via console logs if we could see them, 
    // but here we check the output class "risk" field)

    // We expect the Botnet to be HIGH risk due to:
    // 1. Funding (Same Source) -> +35 (approx)
    // 2. Temporal (Same buy time) -> +30
    // 3. Module C (Ring transfers) -> +25
    // 4. Module D (Sync Sell) -> +40
    // Total should be capped at 100.

    const botCluster = result.clusters.find(c => c.wallets.some(w => w.address.includes('Bot')));
    if (botCluster) {
        console.log(`\n✅ Botnet Detected! Risk: ${botCluster.risk}`);
        if (botCluster.risk === 'High') {
            console.log('✅ Module C & D scoring is working (pushed risk to HIGH).');
        } else {
            console.log('❌ RISK TOO LOW. Check scoring logic.');
        }
    } else {
        console.log('❌ FAILED TO DETECT BOTNET.');
    }
};

main();
