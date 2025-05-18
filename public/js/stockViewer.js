let chart = null;
let candleSeries = null;
let selectedSymbol = null;
let sma20Series = null;
let sma50Series = null;
let newsMarkers = [];
let currentNews = [];
let lastCandleData = null;

// Function to show loading state
function showLoading() {
    const container = document.querySelector('.chart-container');
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">Loading data...</div>
    `;
    container.appendChild(loadingOverlay);
}

// Function to hide loading state
function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.remove();
    }
}

// Function to search for stocks
async function searchStocks() {
    const searchInput = document.getElementById('searchInput').value;
    if (!searchInput) return;

    try {
        showLoading();
        const response = await fetch(`/api/stocks/search?query=${encodeURIComponent(searchInput)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to search stocks');
        }

        displaySearchResults(data);
    } catch (error) {
        console.error('Error searching stocks:', error);
        alert('Failed to search stocks. Please try again.');
    } finally {
        hideLoading();
    }
}

// Function to display search results
function displaySearchResults(stocks) {
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '';

    stocks.forEach(stock => {
        const stockDiv = document.createElement('div');
        stockDiv.className = 'stock-item';
        stockDiv.innerHTML = `${stock.shortname || stock.longname} (${stock.symbol})`;
        stockDiv.onclick = () => selectStock(stock);
        resultsDiv.appendChild(stockDiv);
    });
}

// Function to select a stock
function selectStock(stock) {
    selectedSymbol = stock.symbol;
    document.getElementById('selectedStock').textContent = `Selected: ${stock.shortname || stock.longname} (${stock.symbol})`;
    document.getElementById('searchResults').innerHTML = '';
    updateChart();
}

// Function to update the chart
async function updateChart() {
    if (!selectedSymbol) {
        alert('Please select a stock first');
        return;
    }

    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }

    try {
        showLoading();
        
        // Clear all existing data
        currentNews = [];
        newsMarkers = [];
        lastCandleData = null;
        
        if (candleSeries) {
            candleSeries.setData([]);
            candleSeries.setMarkers([]);
        }
        if (sma20Series) {
            sma20Series.setData([]);
        }
        if (sma50Series) {
            sma50Series.setData([]);
        }
        
        // Clear the news display
        const newsList = document.getElementById('newsList');
        newsList.innerHTML = '<div class="loading">Loading data...</div>';
        
        console.log(`Fetching data for ${selectedSymbol} from ${startDate} to ${endDate}`);
        
        const response = await fetch(`/api/stocks/${selectedSymbol}/historical?startDate=${startDate}&endDate=${endDate}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch historical data');
        }

        // Log received data
        console.log(`Received historical data: ${data.historical.length} candles`);
        console.log(`Received news data: ${data.news.length} articles`);
        
        // Clear the chart container and recreate chart
        const container = document.getElementById('chart');
        container.innerHTML = '';
        renderChart(data.historical, data.news);

    } catch (error) {
        console.error('Error fetching historical data:', error);
        alert('Failed to fetch historical data. Please try again.');
    } finally {
        hideLoading();
    }
}

// Function to normalize date to YYYY-MM-DD
function normalizeDate(dateStr) {
    // Just take the date part, ignore time
    return dateStr.split('T')[0];
}

// Function to get timestamp for a date
function getDateTimestamp(dateStr) {
    // Use exact same timestamp creation as candlestick data
    const [year, month, day] = dateStr.split('-').map(Number);
    return Date.UTC(year, month - 1, day) / 1000;
}

// Function to format data for candlestick chart
function formatCandlestickData(data) {
    return data.map(item => {
        // Create timestamp at midnight UTC
        const [year, month, day] = item.date.split('T')[0].split('-').map(Number);
        const timestamp = Date.UTC(year, month - 1, day) / 1000;
        
        return {
            time: timestamp,
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close)
        };
    });
}

// Function to calculate SMA
function calculateSMA(data, count) {
    const avg = [];
    for (let i = count - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < count; j++) {
            sum += data[i - j].close;
        }
        avg.push({
            time: data[i].time,
            value: sum / count
        });
    }
    return avg;
}

// Function to toggle SMA visibility
function toggleSMA(period, visible) {
    if (period === 20 && sma20Series) {
        sma20Series.applyOptions({
            visible: visible
        });
    } else if (period === 50 && sma50Series) {
        sma50Series.applyOptions({
            visible: visible
        });
    }
}

// Function to fetch news for a specific date
async function fetchNewsForDate(symbol, date) {
    try {
        const formattedDate = new Date(date * 1000).toISOString().split('T')[0];
        
        // Check if date is in the future
        if (new Date(formattedDate) > new Date()) {
            displayNews([], formattedDate, true);
            return;
        }
        
        // Show loading state
        const newsList = document.getElementById('newsList');
        newsList.innerHTML = '<div class="loading">Fetching news...</div>';
        
        const response = await fetch(`/api/stocks/${symbol}/news?date=${formattedDate}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch news');
        }

        displayNews(data, formattedDate);
    } catch (error) {
        console.error('Error fetching news:', error);
        // Extract the actual error message if it exists
        const errorMessage = error.message.includes('Failed to fetch news:') 
            ? error.message 
            : 'Failed to load news. Please try again later.';
        displayNewsError(errorMessage);
    }
}

// Function to display news
function displayNews(news, date, isFutureDate = false) {
    const newsDate = document.getElementById('newsDate');
    const newsList = document.getElementById('newsList');
    
    // Format date for display
    const displayDate = new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    newsDate.textContent = displayDate;
    
    if (isFutureDate) {
        newsList.innerHTML = `<div class="loading">Cannot fetch news for future date ${displayDate}</div>`;
        return;
    }
    
    if (!news || news.length === 0) {
        newsList.innerHTML = `<div class="loading">No news found for ${displayDate}</div>`;
        return;
    }

    newsList.innerHTML = news.map(item => {
        // Format the published date
        const publishDate = new Date(item.datetime);
        const formattedTime = publishDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const formattedDate = publishDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        // Get sentiment color
        const sentimentColor = getSentimentColor(item.sentiment);
        const sentimentScore = item.sentiment_score ? ` (${item.sentiment_score.toFixed(2)})` : '';

        return `
            <div class="news-item">
                <div class="news-title">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a>
                </div>
                <div class="news-source">
                    <span>${item.source}</span>
                    <span class="news-date">${formattedDate} ${formattedTime}</span>
                </div>
                ${item.sentiment ? `
                <div class="news-sentiment" style="color: ${sentimentColor}">
                    Sentiment: ${item.sentiment}${sentimentScore}
                </div>
                ` : ''}
                <div class="news-summary">${item.summary}</div>
            </div>
        `;
    }).join('');
}

// Helper function to get color for sentiment
function getSentimentColor(sentiment) {
    switch (sentiment?.toLowerCase()) {
        case 'bullish':
        case 'positive':
            return '#26a69a';
        case 'bearish':
        case 'negative':
            return '#ef5350';
        case 'neutral':
            return '#888888';
        default:
            return '#ffffff';
    }
}

// Function to display news error
function displayNewsError(message) {
    const newsList = document.getElementById('newsList');
    const newsDate = document.getElementById('newsDate');
    
    // Clear the date display when showing an error
    newsDate.textContent = '';
    
    // Show a user-friendly error message
    newsList.innerHTML = `
        <div class="loading">
            ${message}
            <br><br>
            <small>Try selecting a different date or refreshing the page.</small>
        </div>
    `;
}

// Function to render the chart
function renderChart(historicalData, newsData) {
    const container = document.getElementById('chart');
    
    // Create chart
    const chartOptions = {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            backgroundColor: '#2d2d2d',
            textColor: '#ffffff',
        },
        grid: {
            vertLines: { color: '#404040' },
            horzLines: { color: '#404040' },
        },
        crosshair: {
            mode: 1,
            vertLine: {
                color: '#555555',
                width: 1,
                style: 0,
            },
            horzLine: {
                color: '#555555',
                width: 1,
                style: 0,
            },
        },
        timeScale: {
            borderColor: '#444444',
            timeVisible: true,
            rightOffset: 5,
            barSpacing: 10,
            fixLeftEdge: true,
            fixRightEdge: true,
            minBarSpacing: 5,
        },
        rightPriceScale: {
            borderColor: '#444444',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
        },
    };

    // Create new chart instance
    chart = window.LightweightCharts.createChart(container, chartOptions);

    // Handle resize
    const resizeHandler = () => {
        chart.applyOptions({
            width: container.clientWidth,
            height: container.clientHeight
        });
    };
    window.addEventListener('resize', resizeHandler);

    // Add candlestick series
    const candlestickOptions = {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: true,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    };

    candleSeries = chart.addCandlestickSeries(candlestickOptions);
    const candleData = formatCandlestickData(historicalData);
    lastCandleData = candleData;
    
    console.log('Formatted candle data:', candleData.map(d => ({
        date: new Date(d.time * 1000).toISOString().split('T')[0],
        time: d.time
    })));
    
    candleSeries.setData(candleData);

    // Add SMA lines with visibility based on checkboxes
    const sma20Visible = document.getElementById('sma20Toggle').checked;
    const sma50Visible = document.getElementById('sma50Toggle').checked;

    sma20Series = chart.addLineSeries({
        color: '#2962FF',
        lineWidth: 2,
        title: 'SMA 20',
        priceLineVisible: false,
        visible: sma20Visible
    });

    sma50Series = chart.addLineSeries({
        color: '#FF6D00',
        lineWidth: 2,
        title: 'SMA 50',
        priceLineVisible: false,
        visible: sma50Visible
    });

    // Calculate and set SMA data
    sma20Series.setData(calculateSMA(candleData, 20));
    sma50Series.setData(calculateSMA(candleData, 50));

    // Add news markers
    addNewsMarkers(newsData);

    // Add click handler for markers
    chart.subscribeClick(handleChartClick);

    // Fit content
    chart.timeScale().fitContent();
}

// Function to create news markers
function addNewsMarkers(newsData) {
    if (!newsData || !newsData.length) return;
    
    currentNews = newsData;
    console.log(`Processing ${newsData.length} total news articles`);
    
    // Group news by date (YYYY-MM-DD)
    const newsByDate = new Map();
    
    // Group news by their date string
    newsData.forEach(news => {
        // Get YYYY-MM-DD format
        const dateStr = news.datetime.split('T')[0];
        if (!newsByDate.has(dateStr)) {
            newsByDate.set(dateStr, []);
        }
        newsByDate.get(dateStr).push(news);
    });

    console.log(`Grouped news into ${newsByDate.size} unique dates`);

    // Create markers array
    const markers = [];
    
    // Convert the Map to an array and sort by date string
    const sortedDates = Array.from(newsByDate.keys()).sort();
    
    // Get all candlestick timestamps for reference
    const candleTimestamps = new Set(lastCandleData.map(candle => candle.time));
    const candleDates = new Set(lastCandleData.map(candle => 
        new Date(candle.time * 1000).toISOString().split('T')[0]
    ));

    console.log('Available candle dates:', Array.from(candleDates));
    
    // Create markers in date order
    for (const dateStr of sortedDates) {
        const newsItems = newsByDate.get(dateStr);
        const timestamp = getDateTimestamp(dateStr);
        
        // Only create a marker if we have a candle for this date
        if (candleTimestamps.has(timestamp)) {
            // Calculate sentiment
            const sentiments = newsItems.map(n => n.sentiment?.toLowerCase() || 'neutral');
            const sentimentCounts = {
                positive: sentiments.filter(s => s === 'positive' || s === 'bullish').length,
                negative: sentiments.filter(s => s === 'negative' || s === 'bearish').length,
                neutral: sentiments.filter(s => s === 'neutral').length
            };
            
            const dominantSentiment = Object.entries(sentimentCounts)
                .reduce((a, b) => a[1] > b[1] ? a : b)[0];
            
            markers.push({
                time: timestamp,
                position: 'aboveBar',
                color: getMarkerColor(dominantSentiment),
                shape: 'circle',
                text: String(newsItems.length),
                size: 1
            });

            console.log(`Created marker for ${dateStr} with ${newsItems.length} articles`);
        } else {
            console.log(`Skipping marker for ${dateStr} - no trading data available`);
        }
    }
    
    // Log marker distribution
    const markersByDate = markers.reduce((acc, marker) => {
        const date = new Date(marker.time * 1000).toISOString().split('T')[0];
        acc[date] = marker.text;
        return acc;
    }, {});
    console.log('Final marker distribution:', markersByDate);
    
    // Set markers on the chart
    candleSeries.setMarkers(markers);
    newsMarkers = markers;
}

// Function to handle chart click
function handleChartClick(param) {
    if (!param.time || !currentNews) return;

    // Convert timestamp back to YYYY-MM-DD using UTC
    const clickedDate = new Date(param.time * 1000).toISOString().split('T')[0];
    
    // Find news for this date
    const newsForDate = currentNews.filter(news => 
        news.datetime.split('T')[0] === clickedDate
    );

    displayNews(newsForDate, clickedDate);
}

// Function to get marker color based on sentiment
function getMarkerColor(sentiment) {
    switch (sentiment?.toLowerCase()) {
        case 'positive':
        case 'bullish':
            return '#26a69a';
        case 'negative':
        case 'bearish':
            return '#ef5350';
        default:
            return '#888888';
    }
}

// Initialize date inputs with default values
function initializeDateInputs() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // Default to 1 month of data
    
    document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
}

// Initialize the application
function initializeApp() {
    initializeDateInputs();
    
    // Add event listener for search input
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchStocks();
        }
    });

    // Initialize chart container
    const container = document.getElementById('chart');
    if (container) {
        container.innerHTML = '<div class="loading">Search for a stock to view chart</div>';
    }
}

// Call initialization when the page loads
document.addEventListener('DOMContentLoaded', initializeApp); 