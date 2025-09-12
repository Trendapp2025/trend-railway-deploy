import { db } from './db';
import { assets, assetPrices } from '../shared/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

// Finnhub API configuration
const FINNHUB_TOKEN = 'd30rl8pr01qnu2qvbpl0d30rl8pr01qnu2qvbplg';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// OpenExchange Rates API configuration for forex
const OPENEXCHANGE_API_KEY = '9655becae9d04bbfbb18c039e305f774';
const OPENEXCHANGE_BASE_URL = 'https://openexchangerates.org/api';

// Cache for storing recent prices to avoid excessive API calls
const priceCache = new Map<string, { price: number; timestamp: Date }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Rate limiting for ExchangeRate.host API
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_MINUTE = 5; // Conservative limit for free tier

// Get all assets
export async function getAllAssets() {
  try {
    const allAssets = await db.query.assets.findMany({
      orderBy: [assets.symbol],
    });
    return allAssets;
  } catch (error) {
    console.error('Error fetching all assets:', error);
    throw new Error('Failed to fetch assets');
  }
}

// Get asset by symbol
export async function getAssetBySymbol(symbol: string) {
  try {
    console.log(`Looking for asset with symbol: ${symbol}`);
    const asset = await db.query.assets.findFirst({
      where: eq(assets.symbol, symbol),
    });
    
    if (!asset) {
      console.log(`Asset not found for symbol: ${symbol}`);
      // Let's also check what assets exist in the database
      const allAssets = await db.query.assets.findMany();
      console.log(`Available assets in database:`, allAssets.map(a => ({ symbol: a.symbol, name: a.name, type: a.type })));
    } else {
      console.log(`Found asset:`, { symbol: asset.symbol, name: asset.name, type: asset.type });
    }
    
    return asset;
  } catch (error) {
    console.error('Error fetching asset by symbol:', error);
    throw new Error('Failed to fetch asset');
  }
}

// Get current price for an asset by ID
export async function getCurrentPrice(assetId: string): Promise<number | null> {
  try {
    const latestPrice = await db.query.assetPrices.findFirst({
      where: eq(assetPrices.assetId, assetId),
      orderBy: [desc(assetPrices.timestamp)],
    });
    
    return latestPrice?.price || null;
  } catch (error) {
    console.error('Error fetching current price:', error);
    return null;
  }
}

// Get asset price from cache or database
export async function getAssetPrice(symbol: string): Promise<number | null> {
  const cacheKey = symbol.toUpperCase();
  const cached = priceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp.getTime() < CACHE_DURATION) {
    return cached.price;
  }

  // Get from database
  const asset = await db.query.assets.findFirst({
    where: eq(assets.symbol, symbol),
  });

  if (!asset) {
    return null;
  }

  const latestPrice = await db.query.assetPrices.findFirst({
    where: eq(assetPrices.assetId, asset.id),
    orderBy: [desc(assetPrices.timestamp)],
  });

  if (latestPrice) {
    const price = parseFloat(latestPrice.price.toString());
    priceCache.set(cacheKey, { price, timestamp: latestPrice.timestamp });
    return price;
  }

  return null;
}

// Enhanced live price fetching for accurate prediction evaluation
export async function getLiveAssetPrice(symbol: string): Promise<number | null> {
  try {
    const asset = await getAssetBySymbol(symbol);
    if (!asset) {
      console.error(`Asset not found: ${symbol}`);
      return null;
    }

    // Use Finnhub for all asset types
    const price = await getFinnhubPrice(symbol, asset.type);
    
    if (price && price > 0) {
      // Store the price in database
      await storeAssetPrice(asset.id, price, 'finnhub');
    }

    return price;
  } catch (error) {
    console.error(`Error fetching live price for ${symbol}:`, error);
    return null;
  }
}

// Finnhub price fetching functions
export async function getFinnhubPrice(symbol: string, type: string): Promise<number | null> {
  try {
    let price: number | null = null;
    
    switch (type) {
      case 'crypto':
        price = await getFinnhubCryptoPrice(symbol);
        break;
      case 'stock':
        price = await getFinnhubStockPrice(symbol);
        break;
      case 'forex':
        // Try Finnhub first, then OpenExchange as fallback
        price = await getFinnhubForexPrice(symbol);
        if (!price || price <= 0) {
          console.log(`Finnhub forex failed for ${symbol}, trying OpenExchange...`);
          price = await getOpenExchangeForexPrice(symbol);
        }
        break;
      default:
        console.error(`Unknown asset type for Finnhub: ${type}`);
        return null;
    }
    
    if (price !== null && price >= 0) {
      console.log(`Price for ${symbol} (${type}): ${price}`);
      return price;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching Finnhub price for ${symbol}:`, error);
    return null;
  }
}

// Get crypto price from Finnhub
async function getFinnhubCryptoPrice(symbol: string): Promise<number | null> {
  try {
    // Handle Binance symbols by extracting the base currency
    let finnhubSymbol = symbol;
    
    if (symbol.startsWith('BINANCE:')) {
      // Extract the base currency from Binance symbol (e.g., BINANCE:BTCUSDT -> BTC)
      const tradingPair = symbol.replace('BINANCE:', '');
      let baseSymbol = tradingPair;
      
      // Try to extract base currency by removing common quote currencies
      const quoteCurrencies = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'FDUSD', 'TRY', 'BUSD', 'DAI'];
      for (const quote of quoteCurrencies) {
        if (tradingPair.endsWith(quote)) {
          baseSymbol = tradingPair.slice(0, -quote.length);
          break;
        }
      }
      
      finnhubSymbol = baseSymbol;
    }
    
    const response = await fetch(
      `${FINNHUB_BASE_URL}/quote?symbol=${finnhubSymbol}&token=${FINNHUB_TOKEN}`,
      {
        headers: {
          'User-Agent': 'Trend-App/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch Finnhub crypto price for ${symbol} (${finnhubSymbol}): ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Check if we got a valid response
    if (data.c && typeof data.c === 'number' && data.c > 0) {
      console.log(`Finnhub crypto price for ${symbol} (${finnhubSymbol}): ${data.c}`);
      return data.c; // 'c' is current price in Finnhub API
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching Finnhub crypto price for ${symbol}:`, error);
    return null;
  }
}

// Get stock price from Finnhub
async function getFinnhubStockPrice(symbol: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_TOKEN}`,
      {
        headers: {
          'User-Agent': 'Trend-App/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch Finnhub stock price for ${symbol}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Check if we got a valid response
    if (data.c && typeof data.c === 'number' && data.c > 0) {
      return data.c; // 'c' is current price in Finnhub API
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching Finnhub stock price for ${symbol}:`, error);
    return null;
  }
}

// Get forex price from Finnhub
async function getFinnhubForexPrice(symbol: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/forex/rates?base=${symbol.split('/')[0]}&token=${FINNHUB_TOKEN}`,
      {
        headers: {
          'User-Agent': 'Trend-App/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch Finnhub forex price for ${symbol}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Extract the rate for the target currency
    const targetCurrency = symbol.split('/')[1];
    if (data.quote && data.quote[targetCurrency] !== undefined) {
      const rate = data.quote[targetCurrency];
      if (typeof rate === 'number' && rate >= 0) {
        return rate;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching Finnhub forex price for ${symbol}:`, error);
    return null;
  }
}

// Get forex price from OpenExchange Rates
async function getOpenExchangeForexPrice(symbol: string): Promise<number | null> {
  try {
    // Handle OANDA symbols by converting format
    let processedSymbol = symbol;
    if (symbol.startsWith('OANDA:')) {
      // Convert OANDA:EUR_USD to EUR/USD
      processedSymbol = symbol.replace('OANDA:', '').replace('_', '/');
    }
    
    const [baseCurrency, targetCurrency] = processedSymbol.split('/');
    
    if (!baseCurrency || !targetCurrency) {
      console.error(`Invalid forex symbol format: ${symbol} (processed: ${processedSymbol})`);
      return null;
    }

    // OpenExchange uses USD as base, so we need to calculate the rate
    const response = await fetch(
      `${OPENEXCHANGE_BASE_URL}/latest.json?app_id=${OPENEXCHANGE_API_KEY}`,
      {
        headers: {
          'User-Agent': 'Trend-App/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch OpenExchange forex price for ${symbol}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.rates) {
      console.error(`Invalid OpenExchange response for ${symbol}`);
      return null;
    }

    let rate: number | null = null;

    if (baseCurrency === 'USD') {
      // USD/XXX - get rate directly
      if (data.rates[targetCurrency] !== undefined) {
        rate = data.rates[targetCurrency];
      }
    } else if (targetCurrency === 'USD') {
      // XXX/USD - calculate 1/rate
      if (data.rates[baseCurrency] !== undefined) {
        rate = 1 / data.rates[baseCurrency];
      }
    } else {
      // XXX/YYY - calculate (XXX/USD) / (YYY/USD)
      if (data.rates[baseCurrency] !== undefined && data.rates[targetCurrency] !== undefined) {
        rate = data.rates[targetCurrency] / data.rates[baseCurrency];
      }
    }
    
    if (rate !== null && typeof rate === 'number' && rate >= 0) {
      console.log(`OpenExchange forex price for ${symbol}: ${rate}`);
      return rate;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching OpenExchange forex price for ${symbol}:`, error);
    return null;
  }
}

// Get live crypto price from CoinGecko
export async function getLiveCryptoPrice(symbol: string): Promise<number | null> {
  try {
    // Handle Binance symbols by extracting the base currency
    let coinGeckoId = symbol.toLowerCase();
    
    if (symbol.startsWith('BINANCE:')) {
      // Extract the base currency from Binance symbol (e.g., BINANCE:BTCUSDT -> btc)
      const tradingPair = symbol.replace('BINANCE:', '');
      // For pairs like BTCUSDT, extract BTC; for 1INCHBTC, extract 1INCH
      let baseSymbol = tradingPair;
      
      // Try to extract base currency by removing common quote currencies
      const quoteCurrencies = ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'FDUSD', 'TRY', 'BUSD', 'DAI'];
      for (const quote of quoteCurrencies) {
        if (tradingPair.endsWith(quote)) {
          baseSymbol = tradingPair.slice(0, -quote.length);
          break;
        }
      }
      
      coinGeckoId = baseSymbol.toLowerCase();
      
      // Map common symbols to CoinGecko IDs
      const symbolMap: { [key: string]: string } = {
        'btc': 'bitcoin',
        'eth': 'ethereum',
        'ada': 'cardano',
        'sol': 'solana',
        'dot': 'polkadot',
        'matic': 'matic-network',
        'avax': 'avalanche-2',
        'link': 'chainlink',
        'atom': 'cosmos',
        'near': 'near',
        'ftm': 'fantom',
        'algo': 'algorand',
        'vet': 'vechain',
        'icp': 'internet-computer',
        'fil': 'filecoin',
        'aave': 'aave',
        'uni': 'uniswap',
        'sushi': 'sushi',
        'comp': 'compound-governance-token',
        'mkr': 'maker',
        'snx': 'havven',
        'yfi': 'yearn-finance',
        'crv': 'curve-dao-token',
        '1inch': '1inch',
        'bal': 'balancer',
        'ren': 'republic-protocol',
        'knc': 'kyber-network-crystal',
        'zrx': '0x',
        'bnt': 'bancor',
        'lrc': 'loopring',
        'enj': 'enjincoin',
        'mana': 'decentraland',
        'sand': 'the-sandbox',
        'axs': 'axie-infinity',
        'chz': 'chiliz',
        'flow': 'flow',
        'theta': 'theta-token',
        'xtz': 'tezos',
        'eos': 'eos',
        'trx': 'tron',
        'xlm': 'stellar',
        'xrp': 'ripple',
        'ltc': 'litecoin',
        'bch': 'bitcoin-cash',
        'doge': 'dogecoin',
        'shib': 'shiba-inu',
        'pepe': 'pepe',
        'floki': 'floki',
        'bonk': 'bonk'
      };
      
      coinGeckoId = symbolMap[coinGeckoId] || coinGeckoId;
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`,
      {
        headers: {
          'User-Agent': 'Trend-App/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch live crypto price for ${symbol} (${coinGeckoId}): ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const price = data[coinGeckoId]?.usd;

    if (price && typeof price === 'number') {
      console.log(`Live crypto price for ${symbol} (${coinGeckoId}): ${price}`);
      return price;
    }

    console.error(`Invalid live crypto price data for ${symbol}:`, data);
    return null;
  } catch (error) {
    console.error(`Error fetching live crypto price for ${symbol}:`, error);
    return null;
  }
}

// Get live stock price from Yahoo Finance
async function getLiveStockPrice(symbol: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Trend-App/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch live stock price for ${symbol}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (price && typeof price === 'number') {
      console.log(`Live stock price for ${symbol}: ${price}`);
      return price;
    }

    console.error(`Invalid live stock price data for ${symbol}:`, data);
    return null;
  } catch (error) {
    console.error(`Error fetching live stock price for ${symbol}:`, error);
    return null;
  }
}

// Check rate limit for ExchangeRate.host API
function checkRateLimit(): boolean {
  const now = Date.now();
  const current = rateLimitMap.get('exchangerate') || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  
  // Reset if window has passed
  if (now > current.resetTime) {
    current.count = 0;
    current.resetTime = now + RATE_LIMIT_WINDOW;
  }
  
  // Check if we're within limits
  if (current.count >= MAX_REQUESTS_PER_MINUTE) {
          console.log(`Rate limit reached for ExchangeRate-API. Resets in ${Math.ceil((current.resetTime - now) / 1000)} seconds`);
    return false;
  }
  
  // Increment counter
  current.count++;
  rateLimitMap.set('exchangerate', current);
  return true;
}

// Get live forex price from ExchangeRate.host with proper rate limiting
async function getLiveForexPrice(symbol: string): Promise<number | null> {
  try {
    // Check rate limit first
    if (!checkRateLimit()) {
      console.log(`Rate limit active for ${symbol}, using cached price`);
      return await getAssetPrice(symbol);
    }

    // Parse currency pair (e.g., "EUR/USD" -> "EUR", "USD")
    const [base, quote] = symbol.split('/');
    
    if (!base || !quote) {
      console.error(`Invalid forex symbol format: ${symbol}`);
      return null;
    }

    // ExchangeRate-API key (required for all endpoints)
    const apiKey = process.env.EXCHANGERATE_API_KEY;
    
    if (!apiKey) {
      console.error('EXCHANGERATE_API_KEY not configured');
      return await getAssetPrice(symbol); // Fallback to cached price
    }

    // Use ExchangeRate-API endpoint for real-time rates
    const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Trend-App/1.0',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error(`Rate limit exceeded for ExchangeRate-API when fetching ${symbol}`);
        // Mark rate limit as exceeded
        rateLimitMap.set('exchangerate', { count: MAX_REQUESTS_PER_MINUTE, resetTime: Date.now() + RATE_LIMIT_WINDOW });
        return await getAssetPrice(symbol); // Fallback to cached price
      }
      console.error(`Failed to fetch live forex price for ${symbol}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Handle API errors
    if (data.result === 'error') {
      console.error(`ExchangeRate-API error:`, data);
      return null;
    }

    console.log(`ExchangeRate-API response structure:`, Object.keys(data));
    console.log(`ExchangeRate-API response sample:`, {
      result: data.result,
      base_code: data.base_code,
      target_code: data.target_code,
      conversion_rate: data.conversion_rate
    });

    // Extract rate from the API response format
    let rate: number | null = null;
    
    // Try different response formats
    if (data.conversion_rates && data.conversion_rates[quote]) {
      rate = data.conversion_rates[quote];
    } else if (data.conversion_rate) {
      rate = data.conversion_rate;
    } else if (data.rates && data.rates[quote]) {
      rate = data.rates[quote];
    }
    
    if (!rate || typeof rate !== 'number') {
      console.error(`No valid conversion rate found for ${quote} in response`);
      console.error('Response structure:', Object.keys(data));
      console.error('Response data:', data);
      
      // Fallback to cached price if available
      const cachedPrice = await getAssetPrice(symbol);
      if (cachedPrice) {
        console.log(`Using cached price for ${symbol}: ${cachedPrice}`);
        return cachedPrice;
      }
      
      return null;
    }

    console.log(`Live forex price for ${symbol}: ${rate} (via ExchangeRate-API)`);
    return rate;
  } catch (error) {
    console.error(`Error fetching live forex price for ${symbol}:`, error);
    return null;
  }
}

// Fetch and store crypto prices from CoinGecko
async function fetchCryptoPrices() {
  try {
    const cryptoAssets = await db.query.assets.findMany({
      where: eq(assets.type, 'crypto'),
    });

    for (const asset of cryptoAssets) {
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${asset.symbol.toLowerCase()}&vs_currencies=usd`
        );

        if (!response.ok) {
          console.error(`Failed to fetch price for ${asset.symbol}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        const price = data[asset.symbol.toLowerCase()]?.usd;

        if (price) {
          await storeAssetPrice(asset.id, price, 'coingecko');
        }
      } catch (error) {
        console.error(`Error fetching crypto price for ${asset.symbol}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in fetchCryptoPrices:', error);
  }
}

// Fetch and store stock prices from Yahoo Finance
async function fetchStockPrices() {
  try {
    const stockAssets = await db.query.assets.findMany({
      where: eq(assets.type, 'stock'),
    });

    for (const asset of stockAssets) {
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${asset.symbol}?interval=1d&range=1d`
        );

        if (!response.ok) {
          console.error(`Failed to fetch stock price for ${asset.symbol}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;

        if (price) {
          await storeAssetPrice(asset.id, price, 'yahoo');
        }
      } catch (error) {
        console.error(`Error fetching stock price for ${asset.symbol}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in fetchStockPrices:', error);
  }
}

// Fetch and store forex prices from ExchangeRate.host with rate limiting
async function fetchForexPrices() {
  try {
    const forexAssets = await db.query.assets.findMany({
      where: eq(assets.type, 'forex'),
    });

    if (forexAssets.length === 0) {
      console.log('No forex assets found to update');
      return;
    }

    // Check rate limit before making any requests
    if (!checkRateLimit()) {
      console.log(`Rate limit reached, skipping forex price update`);
      return;
    }

    // ExchangeRate-API key (required for all endpoints)
    const apiKey = process.env.EXCHANGERATE_API_KEY || '52c0f32f5f21dad8df22ebdf6d6c8c76';

    // Extract all unique currencies from forex assets
    const currencies = new Set<string>();
    forexAssets.forEach(asset => {
      const [base, quote] = asset.symbol.split('/');
      if (base && quote) {
        currencies.add(base);
        currencies.add(quote);
      }
    });

    // Use USD as base and get all currencies in one request
    const currencyList = Array.from(currencies).join(',');
    const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;

    console.log(`Fetching forex rates for currencies: ${currencyList}`);

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Trend-App/1.0',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error(`Rate limit exceeded for ExchangeRate-API when fetching forex prices`);
        // Mark rate limit as exceeded
        rateLimitMap.set('exchangerate', { count: MAX_REQUESTS_PER_MINUTE, resetTime: Date.now() + RATE_LIMIT_WINDOW });
        return;
      }
      console.error(`Failed to fetch forex prices: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    
    // Handle API errors
    if (data.result === 'error') {
      console.error(`ExchangeRate-API error:`, data);
      return;
    }

    console.log(`ExchangeRate-API response:`, JSON.stringify(data, null, 2));

    const rates = data.conversion_rates;
    if (!rates) {
      console.error('No conversion_rates data received from ExchangeRate-API');
      console.error('Response structure:', Object.keys(data));
      return;
    }

    // Process each forex asset
    for (const asset of forexAssets) {
      try {
        const [base, quote] = asset.symbol.split('/');
        
        if (!base || !quote) {
          console.error(`Invalid forex symbol format: ${asset.symbol}`);
          continue;
        }

        // Calculate cross-rate if needed
        let price: number;
        if (rates) {
          if (base === 'USD') {
            price = rates[quote];
          } else if (quote === 'USD') {
            const baseRate = rates[base];
            price = 1 / baseRate;
          } else {
            // Cross-rate calculation: USD/quote / USD/base = base/quote
            const baseRate = rates[base];
            const quoteRate = rates[quote];
            price = quoteRate / baseRate;
          }
        } else {
          console.error('No valid rates data found');
          continue;
        }

        if (price && typeof price === 'number' && isFinite(price)) {
          await storeAssetPrice(asset.id, price, 'exchangerate');
          console.log(`Updated forex price for ${asset.symbol}: ${price} (via ExchangeRate-API)`);
        } else {
          console.error(`Invalid price data for ${asset.symbol}:`, price);
        }
      } catch (error) {
        console.error(`Error processing forex asset ${asset.symbol}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in fetchForexPrices:', error);
  }
}

// Store asset price in database
async function storeAssetPrice(assetId: string, price: number, source: string) {
  try {
    await db.insert(assetPrices).values({
      assetId,
      price: price.toString(),
      timestamp: new Date(),
      source,
    });

    // Clear cache for this asset
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, assetId),
    });
    
    if (asset) {
      priceCache.delete(asset.symbol.toUpperCase());
    }
  } catch (error) {
    console.error('Error storing asset price:', error);
  }
}

// Get price history for an asset
export async function getAssetPriceHistory(symbol: string, days: number = 30) {
  const asset = await db.query.assets.findFirst({
    where: eq(assets.symbol, symbol),
  });

  if (!asset) {
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const prices = await db.query.assetPrices.findMany({
    where: and(
      eq(assetPrices.assetId, asset.id),
      gte(assetPrices.timestamp, cutoffDate)
    ),
    orderBy: [desc(assetPrices.timestamp)],
  });

  return prices.map(price => ({
    price: parseFloat(price.price.toString()),
    timestamp: price.timestamp,
    source: price.source,
  }));
}

// Get asset price at a specific time
export async function getAssetPriceAtTime(symbol: string, timestamp: Date): Promise<number | null> {
  const asset = await db.query.assets.findFirst({
    where: eq(assets.symbol, symbol),
  });

  if (!asset) {
    return null;
  }

  const price = await db.query.assetPrices.findFirst({
    where: and(
      eq(assetPrices.assetId, asset.id),
      lte(assetPrices.timestamp, timestamp)
    ),
    orderBy: [desc(assetPrices.timestamp)],
  });

  return price ? parseFloat(price.price.toString()) : null;
}

// Update all asset prices
export async function updateAllPrices() {
  console.log('Starting price update...');
  
  try {
    await Promise.all([
      fetchCryptoPrices(),
      fetchStockPrices(),
      fetchForexPrices(),
    ]);
    
    console.log('Price update completed');
  } catch (error) {
    console.error('Error updating prices:', error);
  }
}

// Update only forex prices
export async function updateForexPrices() {
  console.log('Starting forex price update...');
  await fetchForexPrices();
  console.log('Forex price update completed');
}

// Initialize default assets
export async function initializeDefaultAssets() {
  try {
    const existingAssets = await db.query.assets.findMany();
    
    if (existingAssets.length > 0) {
      console.log('Assets already initialized');
      return;
    }

    const defaultAssets = [
      // Crypto assets
      { name: 'Bitcoin', symbol: 'bitcoin', type: 'crypto' as const, apiSource: 'coingecko' },
      { name: 'Ethereum', symbol: 'ethereum', type: 'crypto' as const, apiSource: 'coingecko' },
      { name: 'Cardano', symbol: 'cardano', type: 'crypto' as const, apiSource: 'coingecko' },
      { name: 'Solana', symbol: 'solana', type: 'crypto' as const, apiSource: 'coingecko' },
      { name: 'Polkadot', symbol: 'polkadot', type: 'crypto' as const, apiSource: 'coingecko' },
      
      // Stock assets
      { name: 'Apple Inc.', symbol: 'AAPL', type: 'stock' as const, apiSource: 'yahoo' },
      { name: 'Microsoft Corporation', symbol: 'MSFT', type: 'stock' as const, apiSource: 'yahoo' },
      { name: 'Alphabet Inc.', symbol: 'GOOGL', type: 'stock' as const, apiSource: 'yahoo' },
      { name: 'Amazon.com Inc.', symbol: 'AMZN', type: 'stock' as const, apiSource: 'yahoo' },
      { name: 'Tesla Inc.', symbol: 'TSLA', type: 'stock' as const, apiSource: 'yahoo' },
      
      // Forex assets
      { name: 'Euro to US Dollar', symbol: 'EUR/USD', type: 'forex' as const, apiSource: 'exchangerate' },
      { name: 'US Dollar to Japanese Yen', symbol: 'USD/JPY', type: 'forex' as const, apiSource: 'exchangerate' },
      { name: 'British Pound to US Dollar', symbol: 'GBP/USD', type: 'forex' as const, apiSource: 'exchangerate' },
      { name: 'US Dollar to Swiss Franc', symbol: 'USD/CHF', type: 'forex' as const, apiSource: 'exchangerate' },
      { name: 'Australian Dollar to US Dollar', symbol: 'AUD/USD', type: 'forex' as const, apiSource: 'exchangerate' },
      { name: 'US Dollar to Canadian Dollar', symbol: 'USD/CAD', type: 'forex' as const, apiSource: 'exchangerate' },
    ];

    for (const asset of defaultAssets) {
      await db.insert(assets).values(asset);
    }

    console.log('Default assets initialized');
  } catch (error) {
    console.error('Error initializing default assets:', error);
  }
}

// Schedule price updates
export function schedulePriceUpdates() {
  // Update prices every 5 minutes
  setInterval(updateAllPrices, 5 * 60 * 1000);
  
  // Initial update
  setTimeout(updateAllPrices, 1000);
} 