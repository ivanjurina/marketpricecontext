let currentChart = null;
let selectedSymbol = null;

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

// Function to render the chart
function renderChart(data) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (currentChart) {
        currentChart.destroy();
    }

    // Prepare data for the chart
    const chartData = {
        labels: data.map(item => new Date(item.date).toLocaleDateString()),
        datasets: [{
            label: `${selectedSymbol} Stock Price`,
            data: data.map(item => item.close),
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: false
        }]
    };

    // Create new chart
    currentChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Price ($)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `$${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

// Add event listener for search input (search when Enter is pressed)
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchStocks();
    }
}); 