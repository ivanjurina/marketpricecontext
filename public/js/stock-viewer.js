// Stock viewer functionality
let chart = null;
let selectedSymbol = null;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('stockSearch');
    const searchResults = document.getElementById('searchResults');
    const fetchButton = document.getElementById('fetchData');
    const errorMessage = document.getElementById('errorMessage');

    // Initialize chart with empty data
    const ctx = document.getElementById('stockChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Stock Price',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
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
                        text: 'Price'
                    }
                }
            }
        }
    });

    // Search input handler with debouncing
    searchInput.addEventListener('input', () => {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        const query = searchInput.value.trim();
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/stocks/search?query=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error('Search failed');
                
                const stocks = await response.json();
                displaySearchResults(stocks);
            } catch (error) {
                showError('Failed to search for stocks');
            }
        }, 300);
    });

    // Handle search result selection
    function displaySearchResults(stocks) {
        searchResults.innerHTML = '';
        if (stocks.length === 0) {
            searchResults.style.display = 'none';
            return;
        }

        stocks.forEach(stock => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = `${stock.symbol} - ${stock.shortname || stock.longname || 'N/A'}`;
            div.addEventListener('click', () => {
                selectedSymbol = stock.symbol;
                searchInput.value = `${stock.symbol} - ${stock.shortname || stock.longname || 'N/A'}`;
                searchResults.style.display = 'none';
            });
            searchResults.appendChild(div);
        });

        searchResults.style.display = 'block';
    }

    // Fetch data button handler
    fetchButton.addEventListener('click', async () => {
        if (!selectedSymbol) {
            showError('Please select a stock first');
            return;
        }

        const period = document.getElementById('period').value;
        const interval = document.getElementById('interval').value;

        try {
            const response = await fetch(`/api/stocks/${selectedSymbol}/historical?period=${period}&interval=${interval}`);
            if (!response.ok) throw new Error('Failed to fetch historical data');
            
            const data = await response.json();
            updateChart(data);
            hideError();
        } catch (error) {
            showError('Failed to fetch historical data');
        }
    });

    // Update chart with new data
    function updateChart(data) {
        const dates = data.map(item => new Date(item.date).toLocaleDateString());
        const prices = data.map(item => item.close);

        chart.data.labels = dates;
        chart.data.datasets[0].data = prices;
        chart.data.datasets[0].label = `${selectedSymbol} Stock Price`;
        chart.update();
    }

    // Error handling functions
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }
}); 