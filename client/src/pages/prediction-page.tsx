import React, { useState } from 'react';
import { buildApiUrl } from '@/lib/api-config';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AppHeader from '@/components/app-header';
import { EnhancedPredictionForm } from '@/components/enhanced-prediction-form';
import AnalystConsensusCard from '@/components/analyst-consensus-card';

import { API_ENDPOINTS } from "@/lib/api-config";
export default function PredictionPage() {
  const [, params] = useRoute('/predict/:assetSymbol');
  const assetSymbol = params?.assetSymbol;

  const { data: asset, isLoading: isLoadingAsset } = useQuery({
    queryKey: ['asset', assetSymbol],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/assets/${assetSymbol}`));
      if (!response.ok) throw new Error('Failed to fetch asset');
      return response.json();
    },
    enabled: !!assetSymbol,
  });



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
