import React, { useState } from 'react';
import { buildApiUrl } from '@/lib/api-config';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import AppHeader from '@/components/app-header';
import { EnhancedPredictionForm } from '@/components/enhanced-prediction-form';
import AnalystConsensusCard from '@/components/analyst-consensus-card';

import { API_ENDPOINTS } from "@/lib/api-config";
export default function PredictionPage() {
  const [, params] = useRoute('/predict/:assetSymbol');
  const assetSymbol = params?.assetSymbol;
  const [selectedDuration, setSelectedDuration] = useState<string>('short');

  const { data: asset, isLoading: isLoadingAsset } = useQuery({
    queryKey: ['asset', assetSymbol],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/assets/${assetSymbol}`));
      if (!response.ok) throw new Error('Failed to fetch asset');
      return response.json();
    },
    enabled: !!assetSymbol,
  });


  const getDurationOptions = () => [
    { 
      value: 'short', 
      label: 'Short Term'
    },
    { 
      value: 'medium', 
      label: 'Medium Term'
    },
    { 
      value: 'long', 
      label: 'Long Term'
    },
  ];

  if (isLoadingAsset) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container max-w-6xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container max-w-6xl mx-auto px-4 py-6">
          <Card className="border-red-500/20 bg-red-500/10">
            <CardContent className="pt-6">
              <p className="text-red-400 text-center">Asset not found</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-6xl mx-auto px-4 py-6">
        {/* Asset Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                Make Prediction: {asset.name}
              </h1>
              <p className="text-muted-foreground">
                Predict the price movement for {asset.symbol} using our enhanced slot system
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{asset.type}</Badge>
              <Badge variant={asset.isActive ? "default" : "secondary"}>
                {asset.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Analyst Consensus */}
        <div className="mb-8">
          <AnalystConsensusCard assetSymbol={assetSymbol || ''} />
        </div>

        {/* Duration Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Select Duration</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              {getDurationOptions().map((duration) => (
                <Button
                  key={duration.value}
                  variant={selectedDuration === duration.value ? "default" : "outline"}
                  onClick={() => setSelectedDuration(duration.value)}
                  className="flex flex-col h-auto py-4 px-3 text-xs min-h-[80px] justify-center"
                >
                  <span className="font-medium text-sm">{duration.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Prediction Form */}
        <EnhancedPredictionForm
          assetSymbol={asset.symbol}
          onSuccess={() => {
            // Refresh data after successful prediction
            window.location.reload();
          }}
        />
      </main>
    </div>
  );
}
