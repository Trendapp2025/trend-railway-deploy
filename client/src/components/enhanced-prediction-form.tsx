import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { TrendingUp } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { useLanguage } from '../hooks/use-language';

import { API_ENDPOINTS } from "@/lib/api-config";
import { apiRequest } from "@/lib/queryClient";
const predictionSchema = z.object({
  assetSymbol: z.string().min(1, 'Asset is required'),
  duration: z.string().min(1, 'Duration is required'),
  direction: z.enum(['up', 'down'], { required_error: 'Direction is required' }),
});

type PredictionFormData = z.infer<typeof predictionSchema>;

interface EnhancedPredictionFormProps {
  assetSymbol?: string;
  onSuccess?: () => void;
}

export function EnhancedPredictionForm({ assetSymbol, onSuccess }: EnhancedPredictionFormProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDuration, setSelectedDuration] = useState<string>('short');

  const form = useForm<PredictionFormData>({
    resolver: zodResolver(predictionSchema),
    defaultValues: {
      assetSymbol: assetSymbol || '',
      duration: 'short', // Keep this as default
      direction: 'up',
    },
  });
  
  console.log('Form initialized with:', {
    assetSymbol,
    formValues: form.getValues(),
    selectedDuration
  });

  // Monitor duration changes and sync form
  useEffect(() => {
    console.log('Duration state changed:', {
      selectedDuration,
      formDuration: form.getValues('duration'),
      formWatchedDuration: form.watch('duration')
    });
    
    // Ensure form duration is always in sync with selectedDuration
    if (form.getValues('duration') !== selectedDuration) {
      console.log('Syncing form duration from', form.getValues('duration'), 'to', selectedDuration);
      form.setValue('duration', selectedDuration);
    }
  }, [selectedDuration, form]);

  const createPredictionMutation = useMutation({
    mutationFn: async (data: PredictionFormData) => {
      console.log('Creating prediction with data:', data);
      
      const res = await apiRequest('POST', '/api/predictions', {
        ...data,
        amount: 1.0,
        slotNumber: 1,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to create prediction' }));
        throw new Error(error.error || 'Failed to create prediction');
      }
      return res.json();
    },
    onSuccess: () => {
      console.log('Prediction creation succeeded');
      toast({
        title: 'Success!',
        description: 'Your prediction has been submitted successfully.',
      });
      
      // Refresh predictions and slots
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
      queryClient.invalidateQueries({ queryKey: ['slots', selectedDuration] });
      
      // Reset form
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Prediction creation failed with error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit prediction',
        variant: 'destructive',
      });
    },
  });

    const onSubmit = (data: PredictionFormData) => {
    console.log('Form submitted with data:', data);
    console.log('Current selectedDuration:', selectedDuration);
    console.log('Form duration value:', form.getValues('duration'));
    

    // Ensure we use the current selected duration, not the form data
    const mutationData = {
      ...data,
      duration: selectedDuration, // Use selectedDuration instead of form data
    };
    console.log('Calling mutation with data:', mutationData);
    createPredictionMutation.mutate(mutationData);
  };

  const handleDurationChange = (duration: string) => {
    console.log('Duration changed to:', duration);
    setSelectedDuration(duration);
    form.setValue('duration', duration);
    
    // Force form to update immediately
    form.trigger('duration');
    
    console.log('After duration change:', {
      selectedDuration: duration,
      formDuration: form.getValues('duration'),
      formWatchedDuration: form.watch('duration')
    });
  };


  const getDurationOptions = () => [
    { value: 'short', label: 'Short Term (1 Week)', description: '10/3 points' },
    { value: 'medium', label: 'Medium Term (1 Month)', description: '15/5 points' },
    { value: 'long', label: 'Long Term (3 Months)', description: '20/7 points' },
  ];

  const getAssetDisplayName = (symbol: string) => {
    const assetMap: { [key: string]: string } = {
      'bitcoin': 'Bitcoin (BTC)',
      'ethereum': 'Ethereum (ETH)',
      'cardano': 'Cardano (ADA)',
      'solana': 'Solana (SOL)',
      'polkadot': 'Polkadot (DOT)',
      'AAPL': 'Apple Inc. (AAPL)',
      'MSFT': 'Microsoft (MSFT)',
      'GOOGL': 'Alphabet (GOOGL)',
      'AMZN': 'Amazon (AMZN)',
      'TSLA': 'Tesla (TSLA)',
      'EUR/USD': 'EUR/USD',
      'GBP/USD': 'GBP/USD',
      'USD/JPY': 'USD/JPY',
    };
    return assetMap[symbol] || symbol;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Prediction Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Make Prediction</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Asset Display (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="assetSymbol">Asset</Label>
              <div className="flex items-center space-x-2 p-3 border rounded-md bg-muted/50">
                <Badge variant="outline" className="text-sm">
                  {assetSymbol?.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {getAssetDisplayName(assetSymbol || '')}
                </span>
              </div>
            </div>

            {/* Duration Selection */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select
                value={selectedDuration}
                onValueChange={handleDurationChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration">
                    {getDurationOptions().find(d => d.value === selectedDuration)?.label || 'Select duration'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {getDurationOptions().map((duration) => (
                    <SelectItem key={duration.value} value={duration.value}>
                      {duration.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Direction Selection */}
            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={form.watch('direction') === 'up' ? 'default' : 'outline'}
                  onClick={() => form.setValue('direction', 'up')}
                  className="flex-1"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Up
                </Button>
                <Button
                  type="button"
                  variant={form.watch('direction') === 'down' ? 'default' : 'outline'}
                  onClick={() => form.setValue('direction', 'down')}
                  className="flex-1"
                >
                  <TrendingUp className="h-4 w-4 mr-2 rotate-180" />
                  Down
                </Button>
              </div>
            </div>

            


            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={createPredictionMutation.isPending}
            >
              {createPredictionMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting Prediction...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Submit Prediction
                </>
              )}
            </Button>

            {/* Submission Status */}
            {createPredictionMutation.isPending && (
              <div className="text-center text-sm text-muted-foreground">
                Please wait while we submit your prediction...
              </div>
            )}

          </form>
        </CardContent>
      </Card>

    </div>
  );
}
