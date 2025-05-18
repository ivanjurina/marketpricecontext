// First, let's update the package.json with the required dependencies
// Add these to your dependencies in package.json:
// "swagger-jsdoc": "^6.2.8",
// "swagger-ui-express": "^5.0.0"

// Now, let's modify the index.js file to include Swagger documentation

const express = require('express');
const cors = require('cors');
const yahooFinance = require('yahoo-finance2').default;
const axios = require('axios');
const cheerio = require('cheerio');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Market Price Context API',
      version: '1.0.0',
      description: 'API for connecting stock price movements with relevant news',
      contact: {
        name: 'API Support',
        email: 'support@marketpricecontext.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ]
  },
  apis: ['./index.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Home route
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

/**
 * @swagger
 * /api/stocks/search:
 *   get:
 *     summary: Search for stocks by keyword or symbol
 *     description: Returns a list of stocks matching the search query
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         description: Search term
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of matching stocks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   exchange:
 *                     type: string
 *                     description: Stock exchange
 *                   shortname:
 *                     type: string
 *                     description: Short name of the company
 *                   symbol:
 *                     type: string
 *                     description: Stock symbol
 *                   longname:
 *                     type: string
 *                     description: Full company name
 *       400:
 *         description: Missing query parameter
 *       500:
 *         description: Server error
 */
app.get('/api/stocks/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const results = await yahooFinance.search(query);
    
    // Filter to only include stocks (not ETFs, mutual funds, etc. if desired)
    const stocks = results.quotes.filter(item => 
      item.quoteType === 'EQUITY' || item.quoteType === 'STOCK'
    );
    
    res.json(stocks);
  } catch (error) {
    console.error('Error searching for stocks:', error);
    res.status(500).json({ error: 'Failed to search for stocks' });
  }
});

/**
 * @swagger
 * /api/stocks/{symbol}/history:
 *   get:
 *     summary: Get historical price data for a stock
 *     description: Returns historical candlestick data for the specified stock
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         description: Stock symbol (e.g., AAPL, MSFT)
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         description: Time period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max)
 *         schema:
 *           type: string
 *           default: 6mo
 *       - in: query
 *         name: interval
 *         description: Candle interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
 *         schema:
 *           type: string
 *           default: 1d
 *     responses:
 *       200:
 *         description: Array of historical price data points
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                     format: date
 *                     description: Date in YYYY-MM-DD format
 *                   timestamp:
 *                     type: integer
 *                     description: Unix timestamp in milliseconds
 *                   open:
 *                     type: number
 *                     description: Opening price
 *                   high:
 *                     type: number
 *                     description: Highest price
 *                   low:
 *                     type: number
 *                     description: Lowest price
 *                   close:
 *                     type: number
 *                     description: Closing price
 *                   volume:
 *                     type: integer
 *                     description: Trading volume
 *       500:
 *         description: Server error
 */
app.get('/api/stocks/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period, interval } = req.query;
    
    // Default to 6 months of daily data if not specified
    const queryPeriod = period || '6mo';
    const queryInterval = interval || '1d';
    
    const queryOptions = {
      period1: getStartDate(queryPeriod),
      period2: new Date(),
      interval: queryInterval
    };
    
    const result = await yahooFinance.historical(symbol, queryOptions);
    
    // Format data for candlestick chart
    const candleData = result.map(item => ({
      date: item.date.toISOString().split('T')[0],
      timestamp: item.date.getTime(),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume
    }));
    
    res.json(candleData);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

/**
 * @swagger
 * /api/stocks/{symbol}/news:
 *   get:
 *     summary: Get news for a specific stock on a specific date
 *     description: Returns news articles related to the specified stock on the given date
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         description: Stock symbol (e.g., AAPL, MSFT)
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: true
 *         description: Date in YYYY-MM-DD format
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Array of news articles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: News article title
 *                   url:
 *                     type: string
 *                     description: Link to the full article
 *                   publishedTime:
 *                     type: string
 *                     format: date-time
 *                     description: Publication time
 *                   source:
 *                     type: string
 *                     description: News source
 *       400:
 *         description: Missing date parameter
 *       500:
 *         description: Server error
 */
app.get('/api/stocks/:symbol/news', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD)' });
    }
    
    // Get news for the specified stock
    const newsItems = await getYahooFinanceNews(symbol, date);
    
    res.json(newsItems);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// ... [keep all your existing helper functions like getYahooFinanceNews, parseYahooTimeString, and getStartDate]

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
});
