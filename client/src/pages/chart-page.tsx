"use client"

import React from 'react';
import { useRoute } from 'wouter';
import AppHeader from '@/components/app-header';
import TradingViewChart from '@/components/tradingview-chart';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { Link } from 'wouter';

export default function ChartPage() {
  const [, params] = useRoute("/chart/:symbol?");
  const symbol = params?.symbol ? decodeURIComponent(params.symbol) : 'NASDAQ:AAPL';
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/" className="inline-flex items-center text-primary hover:underline">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Assets
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Advanced Trading Chart</h1>
          </div>
          
          <Button
            variant="outline"
            onClick={toggleFullscreen}
            className="flex items-center space-x-2"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span>Fullscreen</span>
              </>
            )}
          </Button>
        </div>

        {/* Chart */}
        <div className="space-y-4">
          <TradingViewChart 
            defaultSymbol={symbol}
            height={700}
            className="w-full"
          />
        </div>

        {/* Chart Features Info */}
        <div className="mt-8 p-6 bg-muted/50 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Chart Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium text-primary">📊 Technical Analysis</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Multiple timeframes (1m to 1w)</li>
                <li>• Built-in indicators (MACD, RSI, Bollinger Bands)</li>
                <li>• Drawing tools and annotations</li>
                <li>• Volume analysis</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-primary">🌍 Multi-Asset Support</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Stocks: NASDAQ, NYSE, TSX</li>
                <li>• Forex: OANDA, FXCM, FX_IDC</li>
                <li>• Crypto: Binance, Coinbase, Kraken</li>
                <li>• Real-time data where available</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-medium text-primary">⚡ Professional Tools</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Advanced chart types</li>
                <li>• Customizable layouts</li>
                <li>• Study templates</li>
                <li>• Export capabilities</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
