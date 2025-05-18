// controllers/stockController.js - Basic structure to check

const yahooFinanceService = require('../services/yahooFinanceService');
const alphaVantageService = require('../services/alphaVantageService');
require('dotenv').config();

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
    const { startDate: reqStartDate, endDate: reqEndDate } = req.query;
    
    // Validate dates with strict UTC handling
    const start = new Date(reqStartDate + 'T00:00:00Z');
    const end = new Date(reqEndDate + 'T23:59:59Z');
    const now = new Date();
    now.setHours(23, 59, 59, 999); // Set to end of current day for comparison
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    // Log validation details
    console.log('Date validation:', {
      requestedStart: start.toISOString(),
      requestedEnd: end.toISOString(),
      currentTime: now.toISOString(),
      isStartFuture: start > now,
      isEndFuture: end > now
    });

    // Check if dates are in the future (compare dates only, not times)
    const startDateOnly = new Date(start.toISOString().split('T')[0]);
    const endDateOnly = new Date(end.toISOString().split('T')[0]);
    const todayDate = new Date(now.toISOString().split('T')[0]);

    if (startDateOnly > todayDate || endDateOnly > todayDate) {
      return res.status(400).json({ 
        error: 'Cannot fetch data for future dates',
        details: {
          requestedStartDate: start.toISOString().split('T')[0],
          requestedEndDate: end.toISOString().split('T')[0],
          currentDate: todayDate.toISOString().split('T')[0]
        }
      });
    }
    
    // Check if start date is after end date
    if (start > end) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }
    
    // Fetch both historical data and news in parallel
    const [historicalData, newsData] = await Promise.all([
      yahooFinanceService.getHistoricalData(symbol, reqStartDate, reqEndDate),
      alphaVantageService.getStockNews(symbol, reqStartDate, reqEndDate)
    ]);

    // Return combined data
    res.json({
      historical: historicalData,
      news: newsData
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
};

// Get news for a stock (now used for getting news details when clicking a marker)
exports.getStockNews = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { date } = req.query;
    
    // Fetch news for a single day when clicking a marker
    const news = await alphaVantageService.getStockNews(symbol, date, date);
    res.json(news);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
};