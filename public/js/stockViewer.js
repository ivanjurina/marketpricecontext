let chart = null;
let candleSeries = null;
let selectedSymbol = null;
let sma20Series = null;
let sma50Series = null;
let lastCandleData = null;

// Function to search for stocks
async function searchStocks() {
    const searchInput = document.getElementById('searchInput').value;
    if (!searchInput) return;

    try {
        const response = await fetch(`/api/stocks/search?query=${encodeURIComponent(searchInput)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to search stocks');
        }

        displaySearchResults(data);
    } catch (error) {
        console.error('Error searching stocks:', error);
        alert('Failed to search stocks. Please try again.');
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

    const period = document.getElementById('periodSelect').value;
    const interval = document.getElementById('intervalSelect').value;

    try {
        const response = await fetch(`/api/stocks/${selectedSymbol}/historical?period=${period}&interval=${interval}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch historical data');
        }

        renderChart(data);
    } catch (error) {
        console.error('Error fetching historical data:', error);
        alert('Failed to fetch historical data. Please try again.');
    }
}

// Function to format data for candlestick chart
function formatCandlestickData(data) {
    return data.map(item => ({
        time: new Date(item.date).getTime() / 1000,
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close)
    }));
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
function renderChart(data) {
    const container = document.getElementById('chart');
    container.innerHTML = ''; // Clear previous chart

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
            mode: 1,  // CrosshairMode.Normal
            vertLine: {
                color: '#555555',
                width: 1,
                style: 0,  // LineStyle.Solid
            },
            horzLine: {
                color: '#555555',
                width: 1,
                style: 0,  // LineStyle.Solid
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

    // Create the chart instance
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
    const candleData = formatCandlestickData(data);
    lastCandleData = candleData; // Store for SMA recalculation
    candleSeries.setData(candleData);

    // Add click handler for candlesticks
    chart.subscribeClick((param) => {
        if (param.time) {
            fetchNewsForDate(selectedSymbol, param.time);
        }
    });

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

    // Fit content
    chart.timeScale().fitContent();
}

// Add event listener for search input (search when Enter is pressed)
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchStocks();
    }
}); 