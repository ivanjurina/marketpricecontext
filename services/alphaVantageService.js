const axios = require('axios');

// You'll need to get an API key from https://www.alphavantage.co/support/#api-key
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

// Helper function to safely parse dates
function safeParseDate(dateStr) {
    try {
        // Handle Alpha Vantage's compact format (e.g., "20221024T092300")
        if (dateStr.includes('T') && !dateStr.includes('-')) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const hour = dateStr.substring(9, 11);
            const minute = dateStr.substring(11, 13);
            const second = dateStr.substring(13, 15);
            
            // Create ISO 8601 format
            const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
            const date = new Date(isoDate);
            
            // Validate the parsed date
            if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
                return date;
            }
            return null;
        }
        
        // Try parsing as regular date string
        const date = new Date(dateStr);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
            return date;
        }
        return null;
    } catch (error) {
        console.error('Error parsing date:', dateStr, error);
        return null;
    }
}

// Fetch news for a specific symbol and date
exports.getStockNews = async (symbol, date) => {
    if (!symbol) {
        throw new ValidationError('Stock symbol is required');
    }

    if (!ALPHA_VANTAGE_API_KEY) {
        console.error('Alpha Vantage API key is not set. Please set ALPHA_VANTAGE_API_KEY environment variable.');
        throw new Error('API configuration error. Please check server logs.');
    }

    try {
        console.log(`Fetching news for ${symbol} on date ${date}`);
        
        // Alpha Vantage's News Sentiment API endpoint
        const response = await axios.get(BASE_URL, {
            params: {
                function: 'NEWS_SENTIMENT',
                tickers: symbol,
                apikey: ALPHA_VANTAGE_API_KEY,
                sort: 'LATEST',  // Changed to LATEST to get chronological order
                limit: 50  // Maximum number of news items to return
            }
        });

        // Log the raw response for debugging
        console.log('Alpha Vantage API Response:', JSON.stringify(response.data, null, 2));

        if (response.data.Error) {
            throw new Error(response.data.Error);
        }

        if (!response.data.feed || !Array.isArray(response.data.feed)) {
            console.error('Unexpected API response format:', response.data);
            throw new Error('Invalid API response format');
        }

        // Get the feed entries
        const articles = response.data.feed || [];
        console.log(`Retrieved ${articles.length} articles before date filtering`);
        
        // Filter articles by date if specified
        const targetDate = date ? new Date(date).toISOString().split('T')[0] : null;
        const filteredArticles = targetDate
            ? articles.filter(article => {
                const parsedDate = safeParseDate(article.time_published);
                if (!parsedDate) {
                    console.log(`Skipping article with invalid date: ${article.time_published}`);
                    return false;
                }
                const articleDate = parsedDate.toISOString().split('T')[0];
                const matches = articleDate === targetDate;
                if (matches) {
                    console.log(`Found matching article for date ${targetDate}:`, article.title);
                }
                return matches;
              })
            : articles;

        console.log(`Filtered to ${filteredArticles.length} articles for date ${targetDate}`);

        // Transform the data to match our application's format
        const transformedArticles = filteredArticles.map(article => {
            const parsedDate = safeParseDate(article.time_published);
            return {
                title: article.title,
                url: article.url,
                source: article.source,
                datetime: parsedDate ? parsedDate.toISOString() : null,
                summary: article.summary,
                sentiment: article.overall_sentiment_label,
                sentiment_score: article.overall_sentiment_score
            };
        }).filter(article => article.datetime !== null);

        return transformedArticles;

    } catch (error) {
        console.error('Alpha Vantage API Error:', error);
        console.error('Error details:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });

        if (error.response?.status === 429) {
            throw new Error('API rate limit exceeded. Please try again later.');
        }
        if (error.response?.status === 403) {
            throw new Error('Invalid API key. Please check your Alpha Vantage API key.');
        }
        throw new Error(error.message || 'Failed to fetch news from Alpha Vantage');
    }
}; 