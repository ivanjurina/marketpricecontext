// services/yahooFinanceService.js - Fixed date handling

const yahooFinance = require('yahoo-finance2').default;
const axios = require('axios');

// Suppress Yahoo Finance notices
yahooFinance.suppressNotices(['yahooSurvey', 'ripHistorical']);

// Constants for validation
const VALID_PERIODS = ['1d', '1w', '1m', '3m', '6m', '1y', '5y'];
const VALID_INTERVALS = ['1d', '1w', '1m'];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Search for stocks
exports.searchStocks = async (query) => {
  if (!query) {
    throw new ValidationError('Search query is required');
  }

  const results = await yahooFinance.search(query);
  
  // Filter to only include stocks
  return results.quotes.filter(item => 
    item.quoteType === 'EQUITY' || item.quoteType === 'STOCK'
  );
};

// Get historical data for a stock
exports.getHistoricalData = async (symbol, period = '1y', interval = '1d') => {
  // Validate inputs
  if (!symbol) {
    throw new ValidationError('Stock symbol is required');
  }

  if (!VALID_PERIODS.includes(period)) {
    throw new ValidationError(`Invalid period. Valid values are: ${VALID_PERIODS.join(', ')}`);
  }

  if (!VALID_INTERVALS.includes(interval)) {
    throw new ValidationError(`Invalid interval. Valid values are: ${VALID_INTERVALS.join(', ')}`);
  }

  try {
    const queryOptions = {
      period1: getStartDate(period),
      interval: interval,
    };
    
    const result = await yahooFinance.historical(symbol, queryOptions);
    return result;
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw error;
    }
    console.error(`Error fetching historical data for ${symbol}:`, error);
    throw new Error('Failed to fetch historical data');
  }
};

// Helper function to calculate start date based on period
function getStartDate(period) {
  const now = new Date();
  switch (period) {
    case '1d':
      return new Date(now.setDate(now.getDate() - 1));
    case '1w':
      return new Date(now.setDate(now.getDate() - 7));
    case '1m':
      return new Date(now.setMonth(now.getMonth() - 1));
    case '3m':
      return new Date(now.setMonth(now.getMonth() - 3));
    case '6m':
      return new Date(now.setMonth(now.getMonth() - 6));
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    case '5y':
      return new Date(now.setFullYear(now.getFullYear() - 5));
    default:
      return new Date(now.setFullYear(now.getFullYear() - 1)); // Default to 1 year
  }
}

// Get news for a stock on a specific date
exports.getStockNews = async (symbol, date) => {
  // Validate inputs
  if (!symbol) {
    throw new ValidationError('Stock symbol is required');
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('Valid date in YYYY-MM-DD format is required');
  }

  try {
    // Convert date to start and end of the day in UTC
    const startDate = new Date(date + 'T00:00:00Z');
    const endDate = new Date(date + 'T23:59:59Z');

    // Check if the date is in the future
    if (startDate > new Date()) {
      console.log(`Requested future date ${date} for symbol ${symbol}, returning empty array`);
      return [];
    }

    try {
      // Use the search method to get news
      const searchResult = await yahooFinance.search(symbol, {
        newsCount: 50,
        quotesCount: 1,
        enableFuzzyQuery: false,
      });

      console.log(`News search result for ${symbol}:`, JSON.stringify(searchResult, null, 2));

      if (!searchResult || !searchResult.news || !Array.isArray(searchResult.news)) {
        console.log(`No news data found for ${symbol}`);
        return [];
      }

      // Helper function to safely convert Unix timestamp to date string
      const getDateFromTimestamp = (timestamp) => {
        // Ensure the timestamp is a proper Unix timestamp (seconds since epoch)
        // If it's too large, it might be in milliseconds
        if (timestamp > 1e10) {
          timestamp = Math.floor(timestamp / 1000);
        }
        const date = new Date(timestamp * 1000);
        // Verify the date is valid and within a reasonable range
        if (isNaN(date.getTime()) || date.getFullYear() > 2100 || date.getFullYear() < 2000) {
          console.log(`Invalid timestamp detected: ${timestamp}`);
          return null;
        }
        return date.toISOString().split('T')[0];
      };

      // Helper function to check if a date is within range
      const isDateInRange = (timestamp) => {
        const newsDateStr = getDateFromTimestamp(timestamp);
        if (!newsDateStr) return false;
        
        console.log(`Comparing news date ${newsDateStr} with requested date ${date}`);
        return newsDateStr === date;
      };

      // Format news items
      const newsForDate = searchResult.news
        .filter(item => {
          if (!item.providerPublishTime) {
            console.log(`News item missing publish time:`, item);
            return false;
          }
          const isInRange = isDateInRange(item.providerPublishTime);
          if (!isInRange) {
            const newsDate = getDateFromTimestamp(item.providerPublishTime);
            console.log(`News item outside date range: ${newsDate || 'invalid date'}`);
          }
          return isInRange;
        })
        .map(item => {
          const timestamp = item.providerPublishTime > 1e10 
            ? Math.floor(item.providerPublishTime / 1000) 
            : item.providerPublishTime;
          return {
            title: item.title,
            source: item.publisher,
            datetime: new Date(timestamp * 1000).toISOString(),
            summary: item.summary || '',
            url: item.link
          };
        });

      if (newsForDate.length === 0) {
        console.log(`No news found for ${symbol} on ${date}, trying extended date range`);
        // Try getting news from the day before and after
        const extendedNews = searchResult.news
          .filter(item => {
            if (!item.providerPublishTime) return false;
            
            const newsDateStr = getDateFromTimestamp(item.providerPublishTime);
            if (!newsDateStr) return false;

            const requestDate = new Date(date);
            
            // Include news from the day before and after
            requestDate.setDate(requestDate.getDate() - 1);
            const prevDate = requestDate.toISOString().split('T')[0];
            requestDate.setDate(requestDate.getDate() + 2);
            const nextDate = requestDate.toISOString().split('T')[0];
            
            const isInRange = newsDateStr === prevDate || newsDateStr === date || newsDateStr === nextDate;
            if (isInRange) {
              console.log(`Found news in extended range for date: ${newsDateStr}`);
            }
            return isInRange;
          })
          .map(item => {
            const timestamp = item.providerPublishTime > 1e10 
              ? Math.floor(item.providerPublishTime / 1000) 
              : item.providerPublishTime;
            return {
              title: item.title,
              source: item.publisher,
              datetime: new Date(timestamp * 1000).toISOString(),
              summary: item.summary || '',
              url: item.link
            };
          });

        console.log(`Found ${extendedNews.length} news items in extended date range`);
        return extendedNews;
      }

      console.log(`Found ${newsForDate.length} news items for ${symbol} on ${date}`);
      return newsForDate;

    } catch (newsError) {
      console.error(`Error fetching news for ${symbol}:`, newsError);
      throw new Error(`Failed to fetch news: ${newsError.message}`);
    }

  } catch (error) {
    console.error(`Error in getStockNews for ${symbol}:`, error);
    if (error.name === 'ValidationError') {
      throw error;
    }
    throw new Error(`Failed to fetch news: ${error.message}`);
  }
};
