// controllers/stockController.js - Basic structure to check

const yahooFinanceService = require('../services/yahooFinanceService');

// Search for stocks by keyword/symbol
exports.searchStocks = async (req, res) => {
  try {
    const { query } = req.query;
    const stocks = await yahooFinanceService.searchStocks(query);
    res.json(stocks);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error searching for stocks:', error);
    res.status(500).json({ error: 'Failed to search for stocks' });
  }
};

// Get historical data for a stock
exports.getHistoricalData = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period, interval } = req.query;
    
    const historicalData = await yahooFinanceService.getHistoricalData(symbol, period, interval);
    res.json(historicalData);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
};