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
