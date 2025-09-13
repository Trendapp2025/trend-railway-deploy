import { useState, useEffect } from 'react';
import { Asset } from '@shared/schema';
import { API_ENDPOINTS } from '@/lib/api-config';

// Cache for price availability
const priceCache = new Map<string, { hasPrice: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook that filters assets to show only those with available prices
 * @param assets - Array of assets to filter
 * @returns Object with filtered assets and loading state
 */
export function useAssetsWithPrices(assets: Asset[]) {
  const [assetsWithPrices, setAssetsWithPrices] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkedCount, setCheckedCount] = useState(0);

  // Check if price is available for an asset
  const checkAssetPrice = async (asset: Asset): Promise<boolean> => {
    const symbol = asset.symbol;
    
    // Check cache first
    const cached = priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.hasPrice;
    }

    try {
      // Try live price first
      const response = await fetch(API_ENDPOINTS.ASSET_LIVE_PRICE(symbol), {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        const hasPrice = data.price !== null && data.price !== undefined && typeof data.price === 'number' && !isNaN(data.price);
        
        priceCache.set(symbol, { hasPrice, timestamp: Date.now() });
        return hasPrice;
      }
    } catch (error) {
      // Live price failed, try cached price
      try {
        const cachedResponse = await fetch(API_ENDPOINTS.ASSET_PRICE(symbol), {
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (cachedResponse.ok) {
          const data = await cachedResponse.json();
          const hasPrice = data.price !== null && data.price !== undefined && typeof data.price === 'number' && !isNaN(data.price);
          
          priceCache.set(symbol, { hasPrice, timestamp: Date.now() });
          return hasPrice;
        }
      } catch (cachedError) {
        // Both failed
      }
    }

    // If both APIs failed, assume no price
    priceCache.set(symbol, { hasPrice: false, timestamp: Date.now() });
    return false;
  };

  // Process assets in small batches
  const processAssets = async (assetsToCheck: Asset[]) => {
    const batchSize = 5; // Smaller batch size to avoid rate limiting
    const validAssets: Asset[] = [];
    
    for (let i = 0; i < assetsToCheck.length; i += batchSize) {
      const batch = assetsToCheck.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (asset) => {
        const hasPrice = await checkAssetPrice(asset);
        return { asset, hasPrice };
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Add assets with prices to results
      const validBatchAssets = batchResults
        .filter(result => result.hasPrice)
        .map(result => result.asset);
      
      validAssets.push(...validBatchAssets);
      
      // Update state progressively
      setAssetsWithPrices([...validAssets]);
      setCheckedCount(i + batch.length);
      
      // Small delay between batches
      if (i + batchSize < assetsToCheck.length) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Increased delay to avoid rate limiting
      }
    }
    
    return validAssets;
  };

  useEffect(() => {
    if (assets.length === 0) {
      setAssetsWithPrices([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCheckedCount(0);
    setAssetsWithPrices([]);

    processAssets(assets).finally(() => {
      setIsLoading(false);
    });
  }, [assets]);

  const progress = Math.round((checkedCount / assets.length) * 100);

  return {
    assetsWithPrices,
    isLoading,
    progress,
    checkedCount,
    totalCount: assets.length,
  };
}
