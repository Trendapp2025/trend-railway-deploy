import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/hooks/use-language';

import { API_ENDPOINTS } from "@/lib/api-config";
interface AnalystConsensusData {
  buy: number; // Actual count of buy predictions
  hold: number; // Actual count of hold predictions
  sell: number; // Actual count of sell predictions
  buyPercentage: number; // Percentage for pie chart
  holdPercentage: number; // Percentage for pie chart
  sellPercentage: number; // Percentage for pie chart
  total: number;
  averagePrice: number;
  priceChange: number;
  lowEstimate: number;
  highEstimate: number;
  analystCount: number;
  recommendation: string;
  priceHistory: Array<{
    date: string;
    price: number;
  }>;
  priceProjections: Array<{
    date: string;
    low: number;
    average: number;
    high: number;
  }>;
}

interface AnalystConsensusCardProps {
  assetSymbol: string;
  data?: AnalystConsensusData;
  loading?: boolean;
}

export default function AnalystConsensusCard({ assetSymbol, data, loading }: AnalystConsensusCardProps) {
  const { t } = useLanguage();
  const [selectedDuration, setSelectedDuration] = useState<'short' | 'medium' | 'long'>('short');
  
  // Fetch real analyst consensus data
  const { data: apiData, isLoading, error, refetch } = useQuery({
    queryKey: ['analyst-consensus', assetSymbol, selectedDuration],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/analyst-consensus/${encodeURIComponent(assetSymbol)}?duration=${selectedDuration}`));
      if (!response.ok) {
        throw new Error('Failed to fetch analyst consensus');
      }
      return response.json() as Promise<AnalystConsensusData>;
    },
    enabled: !!assetSymbol,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for testing
  });

  const displayData = data || apiData;
  const isLoadingData = loading || isLoading;

  // Show loading state
  if (isLoadingData) {
    return (
      <div className="bg-muted/50 p-6 rounded-lg">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                Loading analyst consensus...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error && !data) {
    return (
      <div className="bg-muted/50 p-6 rounded-lg">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                {t('analyst.error_consensus')}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                {t('analyst.error_price')}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Handle no data state
  if (!displayData) {
    return (
      <div className="bg-muted/50 p-6 rounded-lg">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                {t('analyst.no_consensus')}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                {t('analyst.no_price')}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const pieData = [
    { name: t('analyst.buy'), value: displayData.buy || 0, color: '#22c55e' },
    { name: t('analyst.sell'), value: displayData.sell || 0, color: '#ef4444' }
  ];

  // Get the last historical data point to start prediction lines from there
  const lastHistoricalData = displayData.priceHistory && displayData.priceHistory.length > 0 
    ? displayData.priceHistory[displayData.priceHistory.length - 1] 
    : null;

  // Get the prediction values
  const upPredictionValue = displayData.priceProjections && displayData.priceProjections.length > 0 
    ? displayData.priceProjections[0].high 
    : 0;
  const downPredictionValue = displayData.priceProjections && displayData.priceProjections.length > 0 
    ? displayData.priceProjections[0].low 
    : 0;

  // Create separate data for historical line (no prediction values)
  const historicalData = (displayData.priceHistory || []).map(item => ({ 
    ...item, 
    type: 'historical'
  }));

  // Create chart data with only historical data
  const chartData = historicalData;

  // Create prediction data that shows trend projections from the historical end point
  const predictionData = [];
  
  if (lastHistoricalData) {
    console.log('Last historical data:', lastHistoricalData);
    console.log('Up prediction value:', upPredictionValue);
    console.log('Down prediction value:', downPredictionValue);
    
    // Calculate trend projections based on current price and prediction values
    const currentPrice = lastHistoricalData.price;
    const upTrend = upPredictionValue > currentPrice ? upPredictionValue : currentPrice * 1.1; // 10% up if no specific target
    const downTrend = downPredictionValue < currentPrice ? downPredictionValue : currentPrice * 0.9; // 10% down if no specific target
    
    // Create future dates for projections (next 6 months)
    const futureDates = [];
    const lastDate = new Date(lastHistoricalData.date);
    for (let i = 1; i <= 6; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setMonth(futureDate.getMonth() + i);
      futureDates.push(futureDate.toISOString().split('T')[0]);
    }
    
    // Start prediction lines from the exact end of historical data
    // First point: exactly where historical line ends
    predictionData.push({
      ...lastHistoricalData,
      type: 'connection',
      upProjection: currentPrice, // Start at historical price
      downProjection: currentPrice // Start at historical price
    });
    
    // Add projection data points showing trends - starting from the exact historical end
    futureDates.forEach((date, index) => {
      const progress = (index + 1) / 6; // 0 to 1 progress
      const upPrice = currentPrice + (upTrend - currentPrice) * progress;
      const downPrice = currentPrice + (downTrend - currentPrice) * progress;
      
      predictionData.push({
        date: date,
        type: 'projection',
        upProjection: upPrice,
        downProjection: downPrice
      });
    });
    
  }

  // Create a combined chart data that includes historical + prediction for proper scaling
  const combinedChartData = [...chartData, ...predictionData];

  const getRecommendationColor = (recommendation: string) => {
    if (!recommendation) return 'text-yellow-500';
    if (recommendation.toLowerCase().includes('buy')) return 'text-green-500';
    if (recommendation.toLowerCase().includes('sell')) return 'text-red-500';
    return 'text-yellow-500';
  };

  const getRecommendationBgColor = (recommendation: string) => {
    if (!recommendation) return 'border-yellow-500/20 bg-yellow-500/10';
    if (recommendation.toLowerCase().includes('buy')) return 'border-green-500/20 bg-green-500/10';
    if (recommendation.toLowerCase().includes('sell')) return 'border-red-500/20 bg-red-500/10';
    return 'border-yellow-500/20 bg-yellow-500/10';
  };

  if (isLoadingData) {
    return (
      <div className="bg-muted/50 p-6 rounded-lg">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-card-foreground">{t('analyst.header')}</CardTitle>
                <Info className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-card-foreground">{t('analyst.header_price')}</CardTitle>
                <Info className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/50 p-6 rounded-lg">
      {/* Header with Duration Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('analyst.prompt')}</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('analyst.duration')}</span>
            <Select value={selectedDuration} onValueChange={(value: 'short' | 'medium' | 'long') => setSelectedDuration(value)}>
              <SelectTrigger className="w-32 bg-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                <SelectItem value="short" className="text-foreground hover:bg-muted">{t('analyst.short')}</SelectItem>
                <SelectItem value="medium" className="text-foreground hover:bg-muted">{t('analyst.medium')}</SelectItem>
                <SelectItem value="long" className="text-foreground hover:bg-muted">{t('analyst.long')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Analyst Consensus */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-card-foreground">{t('analyst.header')}</CardTitle>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => refetch()}
                  className="p-1 hover:bg-muted rounded"
                  title="Refresh data"
                >
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                </button>
                <Info className="h-4 w-4 text-blue-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={0}
                      dataKey="value"
                      startAngle={90}
                      endAngle={450}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: string) => [`${value} predictions`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center bg-card rounded-full w-24 h-24 flex items-center justify-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">{displayData.buy || 0}</div>
                      <div className="text-xs text-muted-foreground">{t('analyst.buy')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-sm text-card-foreground">{t('analyst.buy')} {displayData.buy || 0}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-sm text-card-foreground">{t('analyst.sell')} {displayData.sell || 0}%</span>
              </div>
            </div>

            {/* Recommendation Box */}
            <div className={`border rounded-lg p-3 mb-4 ${getRecommendationBgColor(displayData.recommendation || '')}`}>
              <div className={`font-medium ${getRecommendationColor(displayData.recommendation || '')}`}>
                {displayData.recommendation || 'Neutral'}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="text-xs text-muted-foreground">
              {t('analyst.recommendation.disclaimer', { count: displayData.analystCount || 0, symbol: assetSymbol.toUpperCase() })} {' '}
              <span className="text-blue-600 font-medium">{displayData.recommendation || 'Neutral'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel: Analyst Price Target */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-card-foreground">{t('analyst.header_price')}</CardTitle>
              <Info className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            {/* Key Metrics */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-3xl font-bold text-green-600">{displayData.averagePrice || 0}</div>
                <div className="text-sm text-green-600">+{displayData.priceChange || 0}%</div>
              </div>
              <div className="text-sm text-muted-foreground">
                {t('analyst.based_on', { count: displayData.analystCount || 0 })}
              </div>
            </div>

            {/* Price Chart */}
            <div className="h-48 mb-6">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>{t('analyst.last_12')}</span>
                <span>{t('analyst.next_12')}</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedChartData}>
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    domain={['dataMin - 20', 'dataMax + 20']}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => [value.toFixed(2), name]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  {/* Historical line */}
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    data={chartData}
                  />
                  {/* Up predictions line (dotted green) - shows bullish trend */}
                  <Line 
                    type="monotone" 
                    dataKey="upProjection" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#22c55e', r: 3 }}
                    connectNulls={true}
                    data={predictionData}
                  />
                  {/* Down predictions line (dotted red) - shows bearish trend */}
                  <Line 
                    type="monotone" 
                    dataKey="downProjection" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: '#ef4444', r: 3 }}
                    connectNulls={true}
                    data={predictionData}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Price Estimates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">{displayData.sell || 0}</div>
                <div className="text-xs text-muted-foreground">{t('analyst.down_predictions')}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{displayData.buy || 0}</div>
                <div className="text-xs text-muted-foreground">{t('analyst.up_predictions')}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
