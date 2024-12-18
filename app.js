const SHEET_ID = '1uwetY0HWt69NIcIBgEs7II94SUUd_UG6J5Sxe5uO-AM';
const API_KEY = 'AIzaSyDytDPZlv8eA5N-XZiMzrj2BsSjYDNm_co';
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/master?key=${API_KEY}`;
const UPDATE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate?key=${API_KEY}`;

let products = [];
let cart = {};
let categories = new Set();

// Fetch Products from Google Sheets
async function fetchProducts() {
    try {
        const response = await fetch(SHEET_URL);
        const data = await response.json();

        if (!data.values) throw new Error("No data found in the sheet.");

        const rows = data.values;

        products = rows.slice(1).map((row, index) => ({
            id: row[0] || `ID${index + 1}`,
            name: row[1] || 'Unnamed Product',
            category: row[2] || 'Uncategorized',
            costing: row[3] && !isNaN(parseFloat(row[3])) ? parseFloat(row[3]) : 0,
            price: row[4] && !isNaN(parseFloat(row[4])) ? parseFloat(row[4]) : 0,
            stock: row[5] && !isNaN(parseInt(row[5])) ? parseInt(row[5]) : 0,
            image: row[6] || 'https://via.placeholder.com/100',
            rowIndex: index + 2
        }));


        categories = new Set(products.map(p => p.category));
        renderCategories();
        renderProducts();
    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Failed to load products.");
    }
}

// Place Order and Update Stock
async function placeOrder() {
    if (Object.keys(cart).length === 0) {
        alert("Cart is empty!");
        return;
    }

    // Prepare updates for batchUpdate API
    const updates = Object.values(cart).map(item => ({
        range: `master!F${item.rowIndex}`, // Column F for Stock Quantity
        values: [[item.stock]] // New stock value
    }));

    const body = {
        data: updates,
        valueInputOption: 'USER_ENTERED'
    };

    console.log("Request Body:", JSON.stringify(body, null, 2)); // Log request for debugging

    try {
        const response = await fetch(UPDATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const responseData = await response.json();
        console.log("API Response:", responseData); // Log response for debugging

        if (!response.ok) {
            throw new Error(responseData.error.message);
        }

        alert("Order placed successfully! Stock updated.");
        cart = {};
        fetchProducts(); // Reload updated stock
        renderCart();
    } catch (error) {
        console.error("Error updating stock:", error.message);
        alert("Failed to update stock. Check your permissions and API key.");
    }
}


// Render Categories and Products (unchanged)
function renderCategories() {
    const categoryTabs = document.querySelector('.flex.space-x-2.mb-4');
    categoryTabs.innerHTML = `
        <button onclick="setCategory('All')" class="bg-blue-500 text-white px-4 py-2 rounded-full shadow-md">All Menu</button>
    `;
    categories.forEach(category => {
        categoryTabs.innerHTML += `
            <button onclick="setCategory('${category}')" class="bg-gray-200 px-4 py-2 rounded-full">${category}</button>
        `;
    });
}

function renderProducts(category = 'All') {
    const productContainer = document.getElementById('products');
    const filteredProducts = category === 'All' ? products : products.filter(p => p.category === category);

    productContainer.innerHTML = filteredProducts.map(product => `
        <div class="p-4 bg-white rounded-lg shadow text-center">
            <img src="${product.image}" alt="${product.name}" class="w-24 h-24 mx-auto mb-2">
            <h3 class="font-bold">${product.name}</h3>
            <p>Stock: <span id="stock-${product.id}">${product.stock}</span></p>
            <p class="text-blue-600 font-bold">Price: $${product.price.toFixed(2)}</p>
            <button onclick="addToCart('${product.id}')" class="mt-2 w-full bg-blue-500 text-white py-1 rounded-full hover:bg-blue-600">Add</button>
        </div>
    `).join('');
}

function setCategory(category) {
    renderProducts(category);
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product && product.stock > 0) {
        product.stock--;
        document.getElementById(`stock-${product.id}`).textContent = product.stock;

        if (!cart[productId]) {
            cart[productId] = { ...product, quantity: 1 };
        } else {
            cart[productId].quantity++;
        }
        renderCart();
    } else {
        alert('Out of stock!');
    }
}

function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    let subtotal = 0;

    cartContainer.innerHTML = Object.values(cart).map(item => {
        const totalItemPrice = item.price * item.quantity;
        subtotal += totalItemPrice;

        return `
            <div class="flex justify-between mb-2">
                <img src="${item.image}" alt="${item.name}" class="w-12 h-12 rounded-lg">
                <span>${item.name} x${item.quantity}</span>
                <span>$${totalItemPrice.toFixed(2)}</span>
            </div>
        `;
    }).join('');

    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

document.getElementById('placeOrder').addEventListener('click', placeOrder);
document.addEventListener('DOMContentLoaded', fetchProducts);
