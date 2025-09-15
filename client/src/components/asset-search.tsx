import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search as SearchIcon, X } from 'lucide-react';
import { Asset } from '@shared/schema';
import AssetsWithPrices from '@/components/assets-with-prices';
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/lib/api-config';
import { useAssetsWithPrices } from '@/hooks/use-assets-with-prices';

export default function AssetSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch all assets (unlimited)
  const { data: assetsData, isLoading } = useQuery({
    queryKey: ['/api/assets', 'unlimited'],
    queryFn: async () => {
              const response = await fetch(`${API_ENDPOINTS.ASSETS()}?page=1&limit=999999`);
      const data = await response.json();
      return data;
    },
  });

  const assets = assetsData?.assets || [];
  
  // Get assets with prices for search results
  const { assetsWithPrices, isLoading: isCheckingPrices } = useAssetsWithPrices(searchResults);
  
  // Debug: Log the number of assets fetched
  console.log('Total assets fetched from API:', assets.length);
  console.log('Assets data:', assetsData);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  const handleSearch = () => {
    if (!assets || !searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    const query = searchQuery.trim().toLowerCase();
    
    // Make the search more effective with ticker symbols
    // Higher priority for exact ticker matches
    const exactSymbolMatches = assets.filter(asset => 
      asset.symbol.toLowerCase() === query
    );
    
    // If we find exact matches, return only those
    if (exactSymbolMatches.length > 0) {
      console.log("Found exact symbol matches:", exactSymbolMatches);
      setSearchResults(exactSymbolMatches);
      setIsSearching(false);
      return;
    }
    
    // Try case-insensitive searches next
    const results = assets.filter(asset => {
      const assetName = asset.name.toLowerCase();
      const assetSymbol = asset.symbol.toLowerCase();
      const assetType = asset.type.toLowerCase();
      const searchQuery = query.toLowerCase();
      
      // Direct matches
      if (assetName.includes(searchQuery) || 
          assetSymbol.includes(searchQuery) || 
          assetType.includes(searchQuery)) {
        return true;
      }
      
      // Special handling for cryptocurrency search
      if (searchQuery === 'cryptocurrency' || searchQuery === 'crypto') {
        return assetType === 'crypto';
      }
      
      // Special handling for stock search
      if (searchQuery === 'stock' || searchQuery === 'stocks') {
        return assetType === 'stock';
      }
      
      // Special handling for forex search
      if (searchQuery === 'forex' || searchQuery === 'forex') {
        return assetType === 'forex';
      }
      
      return false;
    });
    
    // Log the search results for debugging
    console.log("Search query:", query);
    console.log("Available assets:", assets);
    console.log("Search results:", results);
    
    setSearchResults(results);
    setIsSearching(false);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search for asset by name, symbol, or type"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button onClick={handleSearch} disabled={isLoading || !searchQuery.trim()}>
          <SearchIcon className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {(isSearching || searchResults.length > 0) && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            {searchResults.length === 0 
              ? "No assets found matching your search" 
              : isCheckingPrices 
                ? `Found ${searchResults.length} asset${searchResults.length !== 1 ? 's' : ''} (checking prices...)`
                : `Found ${assetsWithPrices.length} asset${assetsWithPrices.length !== 1 ? 's' : ''} with available prices`}
          </h3>
          {searchResults.length > 0 && <AssetsWithPrices assets={searchResults} />}
        </div>
      )}
    </div>
  );
}