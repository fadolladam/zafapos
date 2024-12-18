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

    const updates = Object.values(cart).map(item => ({
        rowIndex: item.rowIndex,
        newStock: item.stock - item.quantity
    }));

    const orderHistory = Object.values(cart).map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
    }));

    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbzI37hJ0FKboMSyFIfUAfnKAnkD5Yv2UDuwcqVBQjmER0t0MSiNhsxfKBFgZHoQ7DMqgQ/exec', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates, orderHistory })
        });

        alert("Order placed successfully! Stock updated and order saved.");
        cart = {}; // Clear cart
        fetchProducts();
        renderCart();
    } catch (error) {
        console.error("Error placing order:", error);
        alert("Failed to place order. Please try again.");
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
        if (!cart[productId]) {
            cart[productId] = { ...product, quantity: 1, reservedStock: product.stock - 1 };
        } else {
            cart[productId].quantity++;
            cart[productId].reservedStock--; // Temporary display of reduced stock
        }

        // Update UI: Display reserved stock in product list
        document.getElementById(`stock-${product.id}`).textContent = cart[productId].reservedStock;

        renderCart(); // Re-render cart
    } else {
        alert('Product is out of stock!');
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

function printReceipt() {
    const now = new Date();
    const formattedDate = now.toLocaleString();

    // Populate receipt data
    document.getElementById('receipt-date').textContent = formattedDate;

    const receiptItems = Object.values(cart).map(item => `
        <div class="flex justify-between">
            <span>${item.name} x${item.quantity}</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');
    document.getElementById('receipt-items').innerHTML = receiptItems;

    document.getElementById('receipt-subtotal').textContent = document.getElementById('subtotal').textContent;
    document.getElementById('receipt-tax').textContent = document.getElementById('tax').textContent;
    document.getElementById('receipt-total').textContent = document.getElementById('total').textContent;

    // Show receipt, trigger print, and hide after print
    const receipt = document.getElementById('receipt');
    receipt.classList.remove('hidden');

    window.print();

    receipt.classList.add('hidden');
}

async function fetchOrderHistory() {
    try {
        const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets/1uwetY0HWt69NIcIBgEs7II94SUUd_UG6J5Sxe5uO-AM/values/Order%20History?key=AIzaSyDytDPZlv8eA5N-XZiMzrj2BsSjYDNm_co');
        const data = await response.json();

        const rows = data.values.slice(1); // Skip headers
        const historyContainer = document.querySelector('#order-history tbody');

        historyContainer.innerHTML = rows.map(row => `
            <tr>
                <td class="border px-2 py-1">${row[0]}</td>
                <td class="border px-2 py-1">${row[1]}</td>
                <td class="border px-2 py-1">${row[2]}</td>
                <td class="border px-2 py-1">$${row[3]}</td>
                <td class="border px-2 py-1 font-bold">$${row[4]}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error("Error fetching order history:", error);
    }
}

// Call this function to load order history
fetchOrderHistory();
