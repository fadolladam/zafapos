const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/master?key=${API_KEY}`;
let products = [];
let cart = {};

// Fetch products from the server
async function fetchCustomerProducts() {
    try {
        const response = await fetch(SHEET_URL);
        const data = await response.json();

        products = data.values.slice(1).map(row => ({
            id: row[0],
            name: row[1],
            price: parseFloat(row[4]) || 0,
            stock: parseInt(row[5]) || 0,
            image: row[6] || 'https://via.placeholder.com/100',
        }));

        renderCustomerProducts();
    } catch (error) {
        console.error("Error fetching products:", error);
    }
}

// Render products for customers
function renderCustomerProducts() {
    const productContainer = document.getElementById('customer-products');

    productContainer.innerHTML = products.map(product => `
        <div class="p-4 bg-white rounded-lg shadow text-center">
            <img src="${product.image}" alt="${product.name}" class="w-24 h-24 mx-auto mb-2">
            <h3 class="font-bold">${product.name}</h3>
            <p class="text-blue-600 font-bold">$${product.price.toFixed(2)}</p>
        </div>
    `).join('');
}

// Render cart for customers
function renderCustomerCart() {
    const cartContainer = document.getElementById('customer-cart-items');
    const cartItems = Object.values(cart);

    if (cartItems.length === 0) {
        cartContainer.innerHTML = `<p class="text-gray-500">No items in the cart yet.</p>`;
    } else {
        cartContainer.innerHTML = cartItems.map(item => `
            <div class="flex justify-between">
                <span>${item.name} x${item.quantity}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `).join('');
    }

    // Update totals
    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    document.getElementById('customer-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('customer-tax').textContent = `$${tax.toFixed(2)}`;
    document.getElementById('customer-total').textContent = `$${total.toFixed(2)}`;
}

// Listen for updates from the main application
function listenForUpdates() {
const channel = new BroadcastChannel('cart_updates');
channel.onmessage = (event) => {
    console.log("Cart update received:", event.data);
    if (event.data.type === 'update_cart') {
        cart = event.data.data.cart;
        renderCustomerCart();
    }
};


// Initialize the customer display
document.addEventListener('DOMContentLoaded', () => {
    fetchCustomerProducts();
    listenForUpdates();
});

