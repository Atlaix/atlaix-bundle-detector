import { useState } from 'react';
import ScannerInput from './components/ScannerInput';
import TokenInfoCard from './components/TokenInfoCard';
import RiskScoreCard from './components/RiskScoreCard';
import ForensicAnalysisCard from './components/ForensicAnalysisCard';
import BundleControlCard from './components/BundleControlCard';
import VolumeRiskCard from './components/VolumeRiskCard';
import DetectionSteps from './components/DetectionSteps';
import { runFullScan } from './services/scanEngine';
import { ScanResult } from './lib/mockData';

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleScan = async (query: string) => {
    setLoading(true);
    setResult(null);
    try {
      const scanResult = await runFullScan(query);
      setResult(scanResult);
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-black tracking-tight mb-4 bg-gradient-to-r from-primary via-blue-500 to-purple-500 bg-clip-text text-transparent">
            ATLAIX BUNDLE DETECTOR
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Deep forensic analysis for Solana and EVM tokens. Detect bundled supply, 
            coordinatied sybil attacks, and liquidity drain risks.
          </p>
        </header>

        {/* Input */}
        <ScannerInput onScan={handleScan} isLoading={loading} />

        {/* Result Area */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground animate-pulse">Analyzing blockchain forensics...</p>
          </div>
        )}

        {result && (
          <div className="max-w-4xl mx-auto space-y-6">
            <TokenInfoCard data={result} />
            <RiskScoreCard score={result.score} breakdown={result.scoreBreakdown} />
            <ForensicAnalysisCard data={result} />
            {result.bundleControl && <BundleControlCard data={result.bundleControl} />}
            <VolumeRiskCard data={result} />
            <DetectionSteps data={result} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
