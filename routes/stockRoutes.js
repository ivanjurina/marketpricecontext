// routes/stockRoutes.js - Fixed routes file

const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

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
 *       400:
 *         description: Missing query parameter
 *       500:
 *         description: Server error
 */
router.get('/search', stockController.searchStocks);

/**
 * @swagger
 * /api/stocks/{symbol}/historical:
 *   get:
 *     summary: Get historical data for a stock
 *     description: Returns historical price data for a given stock symbol
 *     parameters:
 *       - in: path
 *         name: symbol
 *         required: true
 *         description: Stock symbol (e.g., AAPL)
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         description: Time period for historical data (1d, 1w, 1m, 3m, 6m, 1y, 5y)
 *         schema:
 *           type: string
 *           enum: [1d, 1w, 1m, 3m, 6m, 1y, 5y]
 *           default: 1y
 *       - in: query
 *         name: interval
 *         description: Data interval (1d, 1w, 1m)
 *         schema:
 *           type: string
 *           enum: [1d, 1w, 1m]
 *           default: 1d
 *     responses:
 *       200:
 *         description: Historical stock data
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Server error
 */
router.get('/:symbol/historical', stockController.getHistoricalData);

module.exports = router;