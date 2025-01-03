const SHEET_ID = '1uwetY0HWt69NIcIBgEs7II94SUUd_UG6J5Sxe5uO-AM';
const API_KEY = 'AIzaSyDytDPZlv8eA5N-XZiMzrj2BsSjYDNm_co';
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/master?key=${API_KEY}`;
const ORDER_HISTORY_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Order%20History?key=${API_KEY}`;
const DEPLOYED_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzNk-UV6DHs1MQ1Tv1l8nmWatiA63iWRA_QWmIBY89fwkuGNIB4kglKh5bwB5UHoxH7dA/exec';

let products = [];
let cart = {};
let categories = new Set();

// Fetch Products
async function fetchProducts() {
    try {
        const response = await fetch(SHEET_URL);
        const data = await response.json();

        console.log("API Response:", data); // Log the API response

        if (!data.values || data.values.length < 2) {
            console.error("No product data found in the sheet.");
            return;
        }

        products = data.values.slice(1).map((row, index) => ({
            id: row[0],
            name: row[1],
            category: row[2],
            price: parseFloat(row[4]) || 0,
            stock: parseInt(row[5]) || 0,
            rowIndex: index + 2,
            barcode: row[7] || "", // Assume barcode is in column 8
            image: row[6] || "https://via.placeholder.com/100",
        }));


        console.log("Parsed Products:", products); // Log parsed products

        categories = new Set(products.map(p => p.category));
        renderCategories();
        renderProducts();
    } catch (error) {
        console.error("Error fetching products:", error);
    }
}


// Render Categories
function renderCategories() {
    const tabs = document.getElementById('category-tabs');
    tabs.innerHTML = `
        <button onclick="renderProducts()" class="bg-blue-500 text-white px-4 py-2 rounded-full">All</button>
    ` + Array.from(categories).map(cat => `
        <button onclick="renderProducts('${cat}')" class="bg-gray-200 px-4 py-2 rounded-full">${cat}</button>
    `).join('');
}

// Render Products
function renderProducts(category = null) {
    console.log("Rendering products for category:", category); // Debug category

    const container = document.getElementById("products");
    if (!container) {
        console.error("Products container not found!");
        return;
    }

    const filtered = category ? products.filter(p => p.category === category) : products;

    console.log("Filtered Products:", filtered); // Log filtered products

    container.innerHTML = filtered.map(p => `
        <div class="p-4 bg-white rounded-lg text-center shadow">
            <img src="${p.image}" alt="${p.name}" class="rounded-[20px] mb-2">
            <h3 class="font-bold">${p.name}</h3>
            <p>Stock: <span id="stock-${p.id}">${p.stock}</span></p>
            <p class="text-blue-600 font-bold">Price: $${p.price.toFixed(2)}</p>
            <button onclick="addToCart('${p.id}')" class="mt-2 w-full bg-blue-500 text-white py-1 rounded-full hover:bg-blue-600">Add</button>
        </div>
    `).join('');
}


// Add to Cart
function addToCart(id) {
    const product = products.find(p => p.id === id);

    if (product && product.stock > 0) {
        if (!cart[id]) {
            cart[id] = { ...product, quantity: 0 };
        }

        cart[id].quantity++;
        product.stock--; // Deduct stock from the product

        document.getElementById(`stock-${id}`).textContent = product.stock;
        renderCart();
    } else {
        alert('Out of stock!');
    }
}

// Update Cart Quantity
function updateCartQuantity(id, change) {
    const product = products.find(p => p.id === id);

    if (cart[id]) {
        cart[id].quantity += change;

        if (cart[id].quantity <= 0) {
            // If quantity is 0 or less, remove item from cart
            product.stock += cart[id].quantity - 1; // Return stock to original amount
            delete cart[id];
        } else {
            product.stock -= change; // Adjust stock based on change
        }

        document.getElementById(`stock-${id}`).textContent = product.stock;
        renderCart();
    }
}

// Render Cart
function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    let subtotal = 0;

    cartContainer.innerHTML = Object.values(cart).map(item => {
        const total = item.price * item.quantity;
        subtotal += total;

        return `
            <div class="flex justify-between mb-2">
                <img src="${item.image}" alt="${item.name}" class="w-12 h-12 rounded-lg">
                <span>${item.name} x${item.quantity}</span>
                <div>
                    <button onclick="updateCartQuantity('${item.id}', -1)" class="text-red-500 px-2">-</button>
                    <button onclick="updateCartQuantity('${item.id}', 1)" class="text-green-500 px-2">+</button>
                </div>
                <span>$${total.toFixed(2)}</span>
            </div>
        `;
    }).join('');

    const tax = subtotal * 0.0;
    const total = subtotal + tax;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}


// Place Order and Update Google Sheets
async function placeOrderAndPrint() {
    if (Object.keys(cart).length === 0) {
        alert('Cart is empty!');
        return;
    }

    const invoiceID = `INV-${Date.now()}`;
    const currentDate = new Date().toLocaleString();

    // Prepare stock updates for each product
    const updates = Object.values(cart).map(item => ({
        rowIndex: item.rowIndex, // Row in the master sheet
        newStock: item.stock // Updated stock after deduction
    }));

    // Prepare order history data
    const orderHistory = Object.values(cart).map(item => ({
        invoiceID,
        date: currentDate,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: (item.price * item.quantity).toFixed(2)
    }));

    try {
        // Send stock updates and order history to Google Apps Script
        const response = await fetch(DEPLOYED_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Required for Google Apps Script
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates, orderHistory })
        });

        generateReceipt(invoiceID, currentDate); // Generate and display the receipt
        cart = {}; // Clear the cart
        renderCart();
        fetchProducts(); // Refresh product stock from the sheet
        alert("Order placed successfully! Stock updated.");
    } catch (error) {
        console.error("Error placing order:", error);
        alert("Failed to place order. Please try again.");
    }
}


// Generate Receipt
function generateReceipt(invoiceID, date) {
    document.getElementById('receipt-invoice').textContent = invoiceID;
    document.getElementById('receipt-date').textContent = date;

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

    document.getElementById('receipt').classList.remove('hidden');
}

// Fetch Order History
async function fetchOrderHistory() {
    try {
        const response = await fetch(ORDER_HISTORY_URL);
        const data = await response.json();

        if (!data.values || data.values.length < 2) {
            document.getElementById('order-history').innerHTML = `
                <tr><td colspan="4" class="text-center py-2">No order history available</td></tr>`;
            return;
        }

        const rows = data.values.slice(1); // Skip header row
        const groupedByInvoice = {};

        // Group rows by Invoice ID
        rows.forEach(row => {
            const [invoiceID, date, product, quantity, price, total] = row;
            if (!groupedByInvoice[invoiceID]) {
                groupedByInvoice[invoiceID] = { date, total: 0, items: [] };
            }
            groupedByInvoice[invoiceID].total += parseFloat(total);
            groupedByInvoice[invoiceID].items.push({ product, quantity, price, total });
        });

        renderOrderHistoryTable(groupedByInvoice);
    } catch (error) {
        console.error("Error fetching order history:", error);
    }
}

// Render Order History Table
function renderOrderHistoryTable(groupedByInvoice) {
    const filterDate = document.getElementById('filter-date').value.trim();
    const searchInvoice = document.getElementById('search-invoice').value.trim().toLowerCase();
    const historyContainer = document.getElementById('order-history');

    // Filter orders based on search inputs
    const filteredInvoices = Object.entries(groupedByInvoice).filter(([invoiceID, order]) => {
        const matchesDate = !filterDate || order.date.includes(filterDate);
        const matchesInvoice = !searchInvoice || invoiceID.toLowerCase().includes(searchInvoice);
        return matchesDate && matchesInvoice;
    });

    // If no results found
    if (!filteredInvoices.length) {
        historyContainer.innerHTML = `
            <tr><td colspan="4" class="text-center py-2">No matching orders found</td></tr>`;
        return;
    }

    // Render filtered order history
    historyContainer.innerHTML = filteredInvoices.map(([invoiceID, order]) => `
        <tr>
            <td class="border px-2 py-1 text-center">${invoiceID}</td>
            <td class="border px-2 py-1 text-center">${order.date}</td>
            <td class="border px-2 py-1 text-center">$${order.total.toFixed(2)}</td>
            <td class="border px-2 py-1 text-center">
                <button onclick="viewOrderDetails('${invoiceID}')" class="text-blue-500 underline">View</button>
            </td>
        </tr>
    `).join('');
}

// View Order Details - Fetch all items belonging to the same invoice ID
async function viewOrderDetails(invoiceID) {
    try {
        const response = await fetch(ORDER_HISTORY_URL);
        const data = await response.json();

        if (!data.values || data.values.length < 2) {
            alert("No order details available.");
            return;
        }

        const rows = data.values.slice(1);
        const orderDetails = rows.filter(row => row[0] === invoiceID); // Filter by invoice ID

        if (!orderDetails.length) {
            alert("No details found for this invoice.");
            return;
        }

        // Generate a detailed view of the order
        const detailsHTML = orderDetails.map(item => `
            <div class="flex justify-between mb-2">
                <span>${item[2]} x${item[3]}</span>
                <span>$${(parseFloat(item[4]) * parseInt(item[3])).toFixed(2)}</span>
            </div>
        `).join('');

        // Show a modal or alert with order details
        const details = `
            Invoice ID: ${invoiceID}
            Date: ${orderDetails[0][1]}
            ${orderDetails.map(item => `${item[2]} x${item[3]} - $${item[5]}`).join('\n')}
        `;
        alert(details);

    } catch (error) {
        console.error("Error viewing order details:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    fetchOrderHistory();
});

// View Order Details - Display as Invoice Modal
async function viewOrderDetails(invoiceID) {
    try {
        const response = await fetch(ORDER_HISTORY_URL);
        const data = await response.json();

        if (!data.values || data.values.length < 2) {
            alert("No order details available.");
            return;
        }

        const rows = data.values.slice(1);
        const orderDetails = rows.filter(row => row[0] === invoiceID); // Filter by invoice ID

        if (!orderDetails.length) {
            alert("No details found for this invoice.");
            return;
        }

        // Generate Invoice-like HTML
        const modalContent = `
            <p><strong>Invoice ID:</strong> ${invoiceID}</p>
            <p><strong>Date:</strong> ${orderDetails[0][1]}</p>
            <hr class="my-2">
            <div class="space-y-2">
                ${orderDetails.map(item => `
                    <div class="flex justify-between">
                        <span>${item[2]} x${item[3]}</span>
                        <span>$${(item[4] * item[3]).toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <hr class="my-2">
            <div class="flex justify-between font-bold">
                <span>Total:</span>
                <span>$${orderDetails.reduce((sum, item) => sum + (item[4] * item[3]), 0).toFixed(2)}</span>
            </div>
        `;

        document.getElementById('order-details-content').innerHTML = modalContent;
        document.getElementById('order-details-modal').classList.remove('hidden');

    } catch (error) {
        console.error("Error viewing order details:", error);
    }
}

// Close Modal
function closeModal() {
    document.getElementById('order-details-modal').classList.add('hidden');
}

// Add Event Listener to Search Input
document.getElementById("search-input").addEventListener("input", handleSearch);

function handleSearch(event) {
    const searchTerm = event.target.value.trim().toLowerCase();

    // Filter products based on search term
    const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm) || 
        product.barcode.toLowerCase().includes(searchTerm)
    );

    // Render filtered products
    renderFilteredProducts(filteredProducts);
}

function renderFilteredProducts(filteredProducts) {
    const container = document.getElementById("products");

    if (!filteredProducts.length) {
        container.innerHTML = `<p class="text-center text-gray-500">No products found.</p>`;
        return;
    }

    container.innerHTML = filteredProducts.map(p => `
        <div class="p-4 bg-white rounded-lg text-center shadow">
            <img src="${p.image}" alt="${p.name}" class="rounded-[20px] mb-2">
            <h3 class="font-bold">${p.name}</h3>
            <p>Stock: <span id="stock-${p.id}">${p.stock}</span></p>
            <p class="text-blue-600 font-bold">Price: $${p.price.toFixed(2)}</p>
            <button onclick="addToCart('${p.id}')" class="mt-2 w-full bg-blue-500 text-white py-1 rounded-full hover:bg-blue-600">Add</button>
        </div>
    `).join('');
}

// Initial Rendering
function renderProducts(category = null) {
    const filtered = category ? products.filter(p => p.category === category) : products;
    renderFilteredProducts(filtered);
}
