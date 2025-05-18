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
        // Log the incoming date string
        console.log('Parsing date string:', dateStr);

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
            console.log('Converted to ISO format:', isoDate);
            
            const date = new Date(isoDate);
            console.log('Parsed date:', date.toISOString());
            
            // Validate the parsed date
            if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
                return date;
            }
        }
        
        // Try parsing as regular date string
        const date = new Date(dateStr);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
            console.log('Parsed regular date:', date.toISOString());
            return date;
        }

        console.log('Failed to parse date:', dateStr);
        return null;
    } catch (error) {
        console.error('Error parsing date:', dateStr, error);
        return null;
    }
}

// Format date for Alpha Vantage API (YYYYMMDDTHHMM)
function formatDateForAPI(dateStr) {
    const date = new Date(dateStr);
    date.setUTCHours(0, 0, 0, 0); // Ensure we start at beginning of day
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}T0000`;
}

// Split date range into chunks of specified days
function getDateChunks(startDate, endDate, chunkSize = 7) {  // Smaller chunks to get more complete coverage
    const chunks = [];
    
    // Ensure we're working with Date objects
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    console.log(`Creating chunks from ${start.toISOString()} to ${end.toISOString()}`);

    let currentStart = new Date(start);

    while (currentStart < end) {
        let currentEnd = new Date(currentStart);
        currentEnd.setDate(currentEnd.getDate() + chunkSize - 1); // -1 because we want inclusive ranges
        
        // If chunk end is beyond the overall end date, use the overall end date
        if (currentEnd > end) {
            currentEnd = new Date(end);
        }

        const chunk = {
            start: currentStart.toISOString().split('T')[0],
            end: currentEnd.toISOString().split('T')[0]
        };

        console.log(`Created chunk: ${chunk.start} to ${chunk.end}`);
        chunks.push(chunk);

        // Move to next chunk with small overlap to ensure we don't miss articles
        currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate()); // No +1 to create overlap
    }

    return chunks;
}

// Fetch news for a specific symbol and date range
exports.getStockNews = async (symbol, startDate, endDate) => {
    if (!symbol) {
        throw new ValidationError('Stock symbol is required');
    }

    if (!startDate || !endDate) {
        throw new ValidationError('Start date and end date are required');
    }

    if (!ALPHA_VANTAGE_API_KEY) {
        console.error('Alpha Vantage API key is not set. Please set ALPHA_VANTAGE_API_KEY environment variable.');
        throw new Error('API configuration error. Please check server logs.');
    }

    try {
        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();

        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
        }

        // Check if dates are in the future
        if (start > now || end > now) {
            throw new ValidationError('Cannot fetch news for future dates');
        }

        // Check if start date is after end date
        if (start > end) {
            throw new ValidationError('Start date must be before end date');
        }

        console.log(`Fetching news for ${symbol} from ${startDate} to ${endDate}`);
        
        // Split the date range into chunks
        const dateChunks = getDateChunks(startDate, endDate);
        console.log(`Split date range into ${dateChunks.length} chunks`);

        // Create a Map to store unique articles using date as key
        const uniqueArticlesMap = new Map();

        // Track API errors
        let apiErrors = 0;
        const MAX_API_ERRORS = 3;

        // Fetch news for each chunk
        for (const chunk of dateChunks) {
            console.log(`Processing chunk: ${chunk.start} to ${chunk.end}`);
            
            // Format dates for API
            const formattedStartDate = formatDateForAPI(chunk.start);
            const formattedEndDate = formatDateForAPI(chunk.end);
            
            try {
                // Add delay between chunks to avoid rate limiting
                if (uniqueArticlesMap.size > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Increased delay
                }

                // Make multiple requests with different sort orders to get more articles
                const sortOrders = ['EARLIEST', 'LATEST'];
                
                for (const sort of sortOrders) {
                    console.log(`Fetching with sort order: ${sort}`);
                    
                    const response = await axios.get(BASE_URL, {
                        params: {
                            function: 'NEWS_SENTIMENT',
                            tickers: symbol,
                            apikey: ALPHA_VANTAGE_API_KEY,
                            sort: sort,
                            time_from: formattedStartDate,
                            time_to: formattedEndDate,
                            limit: 200
                        },
                        timeout: 10000 // 10 second timeout
                    });

                    if (response.data.Error) {
                        apiErrors++;
                        throw new Error(response.data.Error);
                    }

                    if (!response.data.feed || !Array.isArray(response.data.feed)) {
                        console.log(`No news feed in response for chunk ${chunk.start} to ${chunk.end} with sort ${sort}`);
                        continue;
                    }

                    // Process articles from this chunk
                    for (const article of response.data.feed) {
                        const parsedDate = safeParseDate(article.time_published);
                        if (!parsedDate) {
                            console.log(`Skipping article with invalid date: ${article.time_published}`);
                            continue;
                        }

                        // Validate article date is within requested range
                        if (parsedDate < start || parsedDate > end) {
                            console.log(`Skipping article outside requested date range: ${article.time_published}`);
                            continue;
                        }

                        // Get article date in YYYY-MM-DD format
                        const articleDate = parsedDate.toISOString().split('T')[0];

                        // Initialize Map for this date if it doesn't exist
                        if (!uniqueArticlesMap.has(articleDate)) {
                            uniqueArticlesMap.set(articleDate, new Map());
                        }

                        // Create a unique key for the article
                        const articleKey = `${article.title}|${article.url}`;
                        
                        // Only add if we haven't seen this article before
                        if (!uniqueArticlesMap.get(articleDate).has(articleKey)) {
                            uniqueArticlesMap.get(articleDate).set(articleKey, {
                                title: article.title,
                                url: article.url,
                                source: article.source,
                                datetime: parsedDate.toISOString(),
                                summary: article.summary,
                                sentiment: article.overall_sentiment_label,
                                sentiment_score: article.overall_sentiment_score,
                                time_published: article.time_published
                            });
                        }
                    }

                    console.log(`Processed ${response.data.feed.length} articles from chunk with sort ${sort}`);
                    
                    // Add delay between sort order requests
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Increased delay
                }

            } catch (error) {
                console.error(`Error fetching chunk ${chunk.start} to ${chunk.end}:`, error.message);
                apiErrors++;
                
                // If we've hit too many API errors, stop trying
                if (apiErrors >= MAX_API_ERRORS) {
                    throw new Error('Too many API errors occurred while fetching news');
                }
                
                // Continue with next chunk
                continue;
            }
        }

        // Log the dates we have articles for
        const collectedDates = Array.from(uniqueArticlesMap.keys()).sort();
        console.log('Collected articles for dates:', collectedDates);

        // Check for gaps in dates
        const startDt = new Date(startDate);
        const endDt = new Date(endDate);
        const allDates = [];
        for (let dt = new Date(startDt); dt <= endDt; dt.setDate(dt.getDate() + 1)) {
            allDates.push(dt.toISOString().split('T')[0]);
        }
        
        const missingDates = allDates.filter(date => !uniqueArticlesMap.has(date));
        if (missingDates.length > 0) {
            console.log('Missing articles for dates:', missingDates);
        }

        // Convert Map values to array and flatten
        const uniqueArticles = Array.from(uniqueArticlesMap.values())
            .map(dateMap => Array.from(dateMap.values()))
            .flat();
            
        console.log(`Final articles count: ${uniqueArticles.length}`);
        
        // Sort articles by datetime
        uniqueArticles.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        
        // Log distribution of articles by date
        const articlesByDate = uniqueArticles.reduce((acc, article) => {
            const date = article.datetime.split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        console.log('Articles distribution by date:', articlesByDate);
        
        return uniqueArticles;

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