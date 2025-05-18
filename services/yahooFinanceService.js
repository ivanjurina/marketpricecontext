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
exports.getHistoricalData = async (symbol, startDate, endDate) => {
  // Validate inputs
  if (!symbol) {
    throw new ValidationError('Stock symbol is required');
  }

  if (!startDate || !endDate) {
    throw new ValidationError('Start date and end date are required');
  }

  try {
    // Parse dates and validate them
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
    }

    if (start > end) {
      throw new ValidationError('Start date must be before end date');
    }

    const queryOptions = {
      period1: start,
      period2: end,
      interval: '1d'
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
