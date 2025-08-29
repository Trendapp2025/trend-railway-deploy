"use client"

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Search, RefreshCw, AlertCircle } from 'lucide-react';
import { useTheme } from 'next-themes';

interface TradingViewChartProps {
  className?: string;
  defaultSymbol?: string;
  height?: number;
}

// TradingView widget configuration
declare global {
  interface Window {
    TradingView: any;
  }
}

const TIMEFRAMES = [
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '15', label: '15m' },
  { value: '60', label: '1h' },
  { value: '240', label: '4h' },
  { value: '1D', label: '1d' },
  { value: '1W', label: '1w' },
];

// Common symbol prefixes for different asset types
const SYMBOL_EXAMPLES = {
  stocks: ['NASDAQ:AAPL', 'NYSE:MSFT', 'NASDAQ:GOOGL', 'NYSE:TSLA'],
  forex: ['OANDA:EURUSD', 'OANDA:GBPUSD', 'OANDA:USDJPY', 'OANDA:AUDUSD'],
  crypto: ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'BINANCE:ADAUSDT', 'BINANCE:DOTUSDT']
};

export default function TradingViewChart({ 
  className = '', 
  defaultSymbol = 'NASDAQ:AAPL',
  height = 500 
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [timeframe, setTimeframe] = useState('60'); // Default to 1h
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  // Initialize TradingView widget
  const initWidget = () => {
    if (!chartContainerRef.current || !window.TradingView) {
      console.error('TradingView not available or container not ready');
      return;
    }

    // Clean up existing widget
    if (widgetRef.current) {
      try {
        widgetRef.current.remove();
      } catch (err) {
        console.warn('Error removing existing widget:', err);
      }
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create a unique container ID
      const containerId = `tradingview-chart-${Date.now()}`;
      chartContainerRef.current.id = containerId;

      console.log('Initializing TradingView widget with:', {
        symbol,
        timeframe,
        containerId
      });

      // Create the widget with minimal configuration
      const widget = new window.TradingView.widget({
        symbol: symbol,
        interval: timeframe,
        container_id: containerId,
        autosize: true,
        theme: theme === 'dark' ? 'dark' : 'light',
        style: '1',
        locale: 'en',
        toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#f1f3f6',
        enable_publishing: false,
        allow_symbol_change: true,
        width: '100%',
        height: height
      });

      // Store the widget reference
      widgetRef.current = widget;

      // Clear loading state after a short delay
      setTimeout(() => {
        console.log('Chart initialization complete');
        setIsLoading(false);
        setError(null);
      }, 2000); // 2 second delay

    } catch (err) {
      console.error('Error initializing TradingView widget:', err);
      setError(`Failed to initialize chart: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  // Load TradingView script
  useEffect(() => {
    const loadTradingViewScript = () => {
      if (typeof window === 'undefined') return;

      // Check if script is already loaded
      if (window.TradingView) {
        console.log('TradingView already loaded');
        setTimeout(() => {
          initWidget();
        }, 100);
        return;
      }

      // Check if script tag already exists
      const existingScript = document.querySelector('script[src*="tradingview.com"]');
      if (existingScript) {
        console.log('TradingView script tag exists, waiting for load...');
        const checkScript = setInterval(() => {
          if (window.TradingView) {
            clearInterval(checkScript);
            console.log('TradingView script loaded from existing tag');
            setTimeout(() => {
              initWidget();
            }, 100);
          }
        }, 100);
        return;
      }

      console.log('Loading TradingView script...');
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => {
        console.log('TradingView script loaded successfully');
        setTimeout(() => {
          initWidget();
        }, 100);
      };
      script.onerror = () => {
        console.error('Failed to load TradingView script');
        setError('Failed to load TradingView script. Please check your internet connection.');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    };

    loadTradingViewScript();

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (err) {
          console.warn('Error cleaning up widget:', err);
        }
      }
    };
  }, []);

  // Update chart when symbol or timeframe changes
  useEffect(() => {
    if (widgetRef.current && window.TradingView && !isLoading) {
      try {
        console.log('Updating chart symbol:', symbol, 'timeframe:', timeframe);
        // Reinitialize widget for symbol/timeframe changes
        setTimeout(() => {
          initWidget();
        }, 500);
      } catch (err) {
        console.error('Error updating chart:', err);
        setTimeout(() => {
          initWidget();
        }, 500);
      }
    }
  }, [symbol, timeframe]);

  // Reinitialize chart when theme changes
  useEffect(() => {
    if (window.TradingView && chartContainerRef.current) {
      console.log('Theme changed, reinitializing chart...');
      initWidget();
    }
  }, [theme]);

  // Handle symbol input change
  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol.trim().toUpperCase());
  };

  // Handle symbol submission
  const handleSymbolSubmit = () => {
    if (symbol.trim()) {
      initWidget();
    }
  };

  // Quick symbol selection
  const handleQuickSymbol = (quickSymbol: string) => {
    setSymbol(quickSymbol);
  };

  // Refresh chart
  const handleRefresh = () => {
    setError(null);
    initWidget();
  };

  // Retry loading
  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    // Reload the script
    const script = document.querySelector('script[src*="tradingview.com"]');
    if (script) {
      script.remove();
    }
    setTimeout(() => {
      const newScript = document.createElement('script');
      newScript.src = 'https://s3.tradingview.com/tv.js';
      newScript.async = true;
      newScript.onload = () => {
        setTimeout(() => {
          initWidget();
        }, 100);
      };
      newScript.onerror = () => {
        setError('Failed to reload TradingView script');
        setIsLoading(false);
      };
      document.head.appendChild(newScript);
    }, 100);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Advanced Chart</CardTitle>
            <CardDescription>
              Professional trading chart for {symbol} - {TIMEFRAMES.find(tf => tf.value === timeframe)?.label}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Symbol Input and Timeframe Selection */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label htmlFor="symbol-input">Symbol</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="symbol-input"
                placeholder="e.g., NASDAQ:AAPL, OANDA:EURUSD, BINANCE:BTCUSDT"
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSymbolSubmit()}
                className="flex-1"
              />
              <Button onClick={handleSymbolSubmit} disabled={isLoading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="sm:w-32">
            <Label htmlFor="timeframe-select">Timeframe</Label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger id="timeframe-select" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Symbol Examples */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Quick Examples:</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SYMBOL_EXAMPLES).map(([type, symbols]) => (
              <div key={type} className="flex flex-wrap gap-1">
                {symbols.map((sym) => (
                  <Button
                    key={sym}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSymbol(sym)}
                    className="text-xs h-7 px-2"
                  >
                    {sym}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Chart Container */}
        <div className="relative">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 border border-red-500/20 rounded-lg z-10">
              <div className="text-center p-6">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-400 font-medium text-lg mb-2">Chart Error</p>
                <p className="text-red-400 text-sm mb-4">{error}</p>
                <div className="flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRetry}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    Retry
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefresh}
                  >
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          )}

                      {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted border border-border rounded-lg z-10">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-foreground">Loading chart...</p>
                  <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
                </div>
              </div>
            )}

                      <div
              ref={chartContainerRef}
              className="w-full border border-border rounded-lg overflow-hidden"
              style={{ height: `${height}px` }}
            />
        </div>

        {/* Chart Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>💡 <strong>Supported Formats:</strong></p>
          <ul className="ml-4 space-y-1">
            <li>• <strong>Stocks:</strong> NASDAQ:AAPL, NYSE:MSFT, TSX:RY</li>
            <li>• <strong>Forex:</strong> OANDA:EURUSD, FXCM:GBPUSD, FX_IDC:USDJPY</li>
            <li>• <strong>Crypto:</strong> BINANCE:BTCUSDT, COINBASE:ETHUSD, KRAKEN:ADAUSD</li>
          </ul>
          <p className="mt-2 text-yellow-500">
            ⚠️ Note: Stock data may be delayed without exchange subscriptions. For real-time data, consider upgrading to Charting Library with custom datafeed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
