const express = require('express');
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.POLY_API_KEY;

// Function to fetch stock symbols from Polygon API
const fetchStocks = async (n) => {
    try {
        const response = await axios.get('https://api.polygon.io/v3/reference/tickers', {
            params: {
                active: true,
                apiKey: API_KEY,
                limit: n || 10,
            }
        });

        const stocks = response.data.results.map(stock => ({
            ...stock,
            // Generate random refresh interval between 1-5 seconds
            refreshInterval: Math.floor(Math.random() * (5 - 1 + 1)) + 1,
        }));

        return stocks;
    } catch (error) {
        console.error('Error fetching stocks:', error);
        throw new Error('Failed to fetch stocks');
    }
};

// Function to fetch previous close prices for given symbol
const fetchPreviousClosePrice = async (ticker) => {
    try {
        const response = await axios.get(`https://api.polygon.io/v2/aggs/ticker/${ticker}/prev`, {
            params: {
                apiKey: API_KEY,
            },
        });

        return response.data;
    } catch (error) {
        console.error(`Error fetching previous close price for ${ticker}:`, error);
        return null;
    }
};

// Function to read stock prices from the file
const readStockPricesFromFile = () => {
    try {
        const data = fs.readFileSync('./stockPrices.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading stock prices from file:', error);
        return [];
    }
};

// Function to fetch previous close prices for all symbols
const fetchPreviousClosePrices = async (tickers) => {
    try {
        const prices = [];

        for (const ticker of tickers) {
            const price = await fetchPreviousClosePrice(ticker);

            if (price) {
                prices.push(price);
            }
        }

        return prices;
    } catch (error) {
        console.error('Error fetching previous close prices:', error);
        return [];
    }
};

// Route to fetch stocks with an optional limit parameter
app.get('/stocks/:n?', async (req, res) => {
    const { n } = req.params;

    try {
        const stocks = await fetchStocks(parseInt(n, 10));
        const tickers = stocks.map(stock => stock.ticker);

        const prices = await fetchPreviousClosePrices(tickers);

        // Store prices in a file (stockPrices.json)
        fs.writeFileSync('stockPrices.json', JSON.stringify(prices, null, 2));

        // Sending the stock data as JSON in the response
        res.json({ stocks, message: 'Stocks fetched successfully' });
    } catch (error) {
        console.error('Error fetching stocks:', error);
        res.status(500).json({ error: 'Failed to fetch stocks' });
    }
});


// Route to fetch price for a specific ticker from the stored file
app.get('/stock/price/:ticker', (req, res) => {
    const { ticker } = req.params;

    try {
        const pricesFromFile = readStockPricesFromFile();
        const requestedPrice = pricesFromFile.find(price => price.ticker === ticker );
        if (requestedPrice) {
            res.json({ ticker, price: requestedPrice.results });
        } else {
            res.status(404).json({ error: 'Ticker not found or price unavailable' });
        }
    } catch (error) {
        console.error('Error fetching ticker price:', error);
        res.status(500).json({ error: 'Failed to fetch ticker price' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
