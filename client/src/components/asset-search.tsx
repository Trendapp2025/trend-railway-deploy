import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search as SearchIcon } from 'lucide-react';
import { Asset } from '@shared/schema';
import AssetsWithPrices from '@/components/assets-with-prices';
import { useQuery } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@/lib/api-config';

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
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search for asset by name, symbol, or type"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          <SearchIcon className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {isSearching && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            {searchResults.length === 0 
              ? "No assets found matching your search" 
              : `Found ${searchResults.length} asset${searchResults.length !== 1 ? 's' : ''}`}
          </h3>
          <AssetsWithPrices assets={searchResults} />
        </div>
      )}
    </div>
  );
}