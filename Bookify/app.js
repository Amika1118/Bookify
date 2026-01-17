// Bookify - Complete Online Bookstore Application

// ============= DATA STORAGE =============
let booksData = [];
let currentUser = null;
let carouselInterval = null;
let cart = [];
let favorites = [];
let userRatings = {};

// ============= INITIALIZATION =============
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    initializeTheme();
    loadBooksData();
    initializeEventListeners();
    initializeRouter();
    updateCartCount();
    updateLoginStatus();
});

// ============= XML DATA LOADING =============
async function loadBooksData() {
    showLoading(true);
    try {
        // Since we can't actually load an external XML file in this environment,
        // we'll use the XML string directly
        const xmlString = "books.xml"
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        booksData = parseXMLBooks(xmlDoc);
        console.log('Books loaded:', booksData.length);
        console.log('Genres found:', [...new Set(booksData.map(book => book.genre))]);
        showLoading(false);
        renderCurrentPage();
    } catch (error) {
        console.error('Error loading books:', error);
        showLoading(false);
        // Fallback to sample data if XML fails
        alert('Error loading books data. Please refresh the page.');
    }
}

function parseXMLBooks(xmlDoc) {
    const books = [];
    const bookNodes = xmlDoc.getElementsByTagName('book');
    
    for (let i = 0; i < bookNodes.length; i++) {
        const book = bookNodes[i];
        
        // Get the ID from the attribute
        const idAttr = book.getAttribute('id');
        const id = idAttr ? parseInt(idAttr) : (i + 1);
        
        // Get other elements
        const title = book.getElementsByTagName('title')[0]?.textContent || 'Unknown Title';
        const author = book.getElementsByTagName('author')[0]?.textContent || 'Unknown Author';
        const genre = book.getElementsByTagName('genre')[0]?.textContent || 'General';
        
        // Handle price - there might be duplicate price tags in some entries
        const priceElements = book.getElementsByTagName('price');
        let priceText = '9.99';
        if (priceElements.length > 0) {
            priceText = priceElements[0].textContent;
        }
        const price = parseFloat(priceText).toFixed(2);
        
        const rating = parseFloat(book.getElementsByTagName('rating')[0]?.textContent || '3.0').toFixed(1);
        const description = book.getElementsByTagName('description')[0]?.textContent || 
                           `${title} is a captivating ${genre.toLowerCase()} book.`;
        
        // Handle stock
        const stockElements = book.getElementsByTagName('stock');
        let stock = 50;
        if (stockElements.length > 0) {
            stock = parseInt(stockElements[0].textContent) || 50;
        }
        
        books.push({
            id: id,
            title: title,
            author: author,
            genre: genre.trim(), // Trim any whitespace
            price: price,
            rating: rating,
            description: description,
            stock: stock
        });
    }
    
    return books;
}

// ============= ROUTER =============
function initializeRouter() {
    window.addEventListener('hashchange', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderCurrentPage();
    });
    window.addEventListener('load', renderCurrentPage);
}

function renderCurrentPage() {
    const hash = window.location.hash || '#/';
    const mainContent = document.getElementById('mainContent');
    
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (hash === '#/' || hash === '') {
        renderHomePage();
    } else if (hash.startsWith('#/book/')) {
        const bookId = parseInt(hash.split('/')[2]);
        renderBookDetailPage(bookId);
    } else if (hash.startsWith('#/genre/')) {
        const genre = decodeURIComponent(hash.split('/')[2]);
        console.log('Navigating to genre:', genre);
        renderGenrePage(genre);
    } else if (hash === '#/genres') {
        renderAllGenresPage();
    } else if (hash === '#/favorites') {
        renderFavoritesPage();
    } else if (hash === '#/cart') {
        renderCheckoutPage();
    } else {
        renderHomePage();
    }
    
    renderCarousel();
}

// ============= PAGE RENDERERS =============
function renderHomePage() {
    const mainContent = document.getElementById('mainContent');
    // Get unique genres from all books
    const allGenres = booksData.map(book => book.genre);
    const uniqueGenres = [...new Set(allGenres)].sort();
    console.log('All genres found:', uniqueGenres);
    
    const featuredBooks = booksData.slice(0, 16); // Show 16 books (4 rows x 4 books)
    
    mainContent.innerHTML = `
        <div class="container">
            <div class="hero">
                <h1>Welcome to Bookify</h1>
                <p>Discover your next favorite book from our vast collection</p>
                <button class="hero-btn" onclick="window.location.hash='#/genres'">Browse All Books</button>
            </div>
            
            <div class="genre-links">
                <h2>Browse by Genre</h2>
                <div class="genre-grid">
                    ${uniqueGenres.map(genre => {
                        const bookCount = booksData.filter(b => b.genre === genre).length;
                        return `
                        <div class="genre-card" onclick="window.location.hash='#/genre/${encodeURIComponent(genre)}'">
                            <div class="icon">${getGenreIcon(genre)}</div>
                            <h3>${genre}</h3>
                            <p>${bookCount} book${bookCount !== 1 ? 's' : ''}</p>
                        </div>
                    `}).join('')}
                </div>
            </div>
            
            <div class="books-section">
                <h2>Featured Books</h2>
                <div class="books-grid books-grid-four">
                    ${featuredBooks.map(book => createBookCard(book)).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderGenrePage(genre) {
    const mainContent = document.getElementById('mainContent');
    console.log('Rendering genre page for:', genre);
    console.log('Available books:', booksData.map(b => ({id: b.id, title: b.title, genre: b.genre})));
    
    const genreBooks = booksData.filter(book => book.genre === genre);
    console.log('Found books for genre', genre, ':', genreBooks.length);
    
    if (genreBooks.length === 0) {
        mainContent.innerHTML = `
            <div class="container">
                <h1>${genre}</h1>
                <div class="empty-state">
                    <h2>No books found in this genre</h2>
                    <p>Try browsing other genres</p>
                    <button class="btn btn-primary" onclick="window.location.hash='#/genres'">Browse All Genres</button>
                </div>
            </div>
        `;
        return;
    }
    
    mainContent.innerHTML = `
        <div class="container">
            <h1>${genre}</h1>
            
            <div class="filters">
                <h3>Filter & Sort</h3>
                <div class="filter-group">
                    <label>Sort by:</label>
                    <select id="sortSelect" onchange="applySorting('${encodeURIComponent(genre)}')">
                        <option value="title">Title</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                        <option value="rating">Rating</option>
                    </select>
                </div>
            </div>
            
            <div class="books-section">
                <div class="books-grid" id="genreBooksGrid">
                    ${genreBooks.map(book => createBookCard(book)).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderAllGenresPage() {
    const mainContent = document.getElementById('mainContent');
    // Get unique genres from all books
    const allGenres = booksData.map(book => book.genre);
    const uniqueGenres = [...new Set(allGenres)].sort();
    
    mainContent.innerHTML = `
        <div class="container">
            <h1>All Genres</h1>
            <div class="genre-grid">
                ${uniqueGenres.map(genre => {
                    const bookCount = booksData.filter(b => b.genre === genre).length;
                    return `
                    <div class="genre-card" onclick="window.location.hash='#/genre/${encodeURIComponent(genre)}'">
                        <div class="icon">${getGenreIcon(genre)}</div>
                        <h3>${genre}</h3>
                        <p>${bookCount} book${bookCount !== 1 ? 's' : ''}</p>
                    </div>
                `}).join('')}
            </div>
        </div>
    `;
}

function renderBookDetailPage(bookId) {
    const book = booksData.find(b => b.id === bookId);
    if (!book) {
        renderHomePage();
        return;
    }
    
    const relatedBooks = booksData.filter(b => b.genre === book.genre && b.id !== book.id).slice(0, 4);
    const userRating = userRatings[bookId] || 0;
    const avgRating = calculateAverageRating(book, userRating);
    
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="container">
            <div class="book-detail">
                <div class="book-detail-cover">${book.title}</div>
                <div class="book-detail-info">
                    <h1>${book.title}</h1>
                    <p class="author">by ${book.author}</p>
                    <div class="book-rating">
                        <span class="stars">${renderStars(avgRating)}</span>
                        <span>(${avgRating})</span>
                    </div>
                    <p class="price">$${book.price}</p>
                    <p class="description">${book.description}</p>
                    
                    <div class="rating-section">
                        <h3>Rate this book:</h3>
                        <div class="star-rating" id="userRating">
                            ${[1,2,3,4,5].map(star => `
                                <span class="star ${star <= userRating ? 'filled' : ''}" data-rating="${star}" onclick="rateBook(${bookId}, ${star})">★</span>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="quantity-selector">
                        <label>Quantity:</label>
                        <button onclick="changeQuantity(-1)">-</button>
                        <input type="number" id="quantity" value="1" min="1" max="${book.stock}">
                        <button onclick="changeQuantity(1)">+</button>
                    </div>
                    
                    <div class="book-actions">
                        <button class="btn btn-primary" onclick="addToCart(${book.id})">Add to Cart</button>
                        <button class="btn btn-favorite ${isFavorite(book.id) ? 'active' : ''}" onclick="toggleFavorite(${book.id})">
                            ${isFavorite(book.id) ? '❤️' : '🤍'}
                        </button>
                    </div>
                </div>
            </div>
            
            ${relatedBooks.length > 0 ? `
                <div class="related-books">
                    <h2>Related Books in ${book.genre}</h2>
                    <div class="books-grid">
                        ${relatedBooks.map(b => createBookCard(b)).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderFavoritesPage() {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    const mainContent = document.getElementById('mainContent');
    const favoriteBooks = booksData.filter(book => favorites.includes(book.id));
    
    mainContent.innerHTML = `
        <div class="container">
            <h1>My Favorites</h1>
            ${favoriteBooks.length > 0 ? `
                <div class="books-grid">
                    ${favoriteBooks.map(book => createBookCard(book)).join('')}
                </div>
            ` : `
                <div class="empty-state">
                    <h2>No favorites yet</h2>
                    <p>Start adding books to your favorites!</p>
                    <button class="btn btn-primary" onclick="window.location.hash='#/'">Browse Books</button>
                </div>
            `}
        </div>
    `;
}

function renderCheckoutPage() {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    const mainContent = document.getElementById('mainContent');
    const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    
    mainContent.innerHTML = `
        <div class="container">
            <div class="checkout-container">
                <h1>Shopping Cart</h1>
                ${cart.length > 0 ? `
                    <div class="cart-items">
                        ${cart.map(item => `
                            <div class="cart-item">
                                <div class="cart-item-image">${item.title}</div>
                                <div class="cart-item-info">
                                    <h3>${item.title}</h3>
                                    <p>by ${item.author}</p>
                                    <p class="price">$${item.price}</p>
                                    <div class="cart-item-controls">
                                        <button onclick="updateCartQuantity(${item.id}, -1)">-</button>
                                        <span>Quantity: ${item.quantity}</span>
                                        <button onclick="updateCartQuantity(${item.id}, 1)">+</button>
                                        <button class="btn btn-favorite" onclick="removeFromCart(${item.id})">Remove</button>
                                    </div>
                                </div>
                                <div>
                                    <strong>$${(parseFloat(item.price) * item.quantity).toFixed(2)}</strong>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="checkout-summary">
                        <div class="summary-row">
                            <span>Subtotal:</span>
                            <span>$${subtotal.toFixed(2)}</span>
                        </div>
                        <div class="summary-row">
                            <span>Tax (8%):</span>
                            <span>$${tax.toFixed(2)}</span>
                        </div>
                        <div class="summary-row total">
                            <span>Total:</span>
                            <span>$${total.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div class="checkout-actions">
                        <button class="btn btn-primary" onclick="processPayment()">Proceed to Payment</button>
                        <button class="btn" onclick="window.location.hash='#/'">Continue Shopping</button>
                    </div>
                ` : `
                    <div class="empty-state">
                        <h2>Your cart is empty</h2>
                        <p>Add some books to get started!</p>
                        <button class="btn btn-primary" onclick="window.location.hash='#/'">Browse Books</button>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderCarousel() {
    const carousel = document.getElementById('bookCarousel');
    if (!carousel) return;
    
    const carouselBooks = booksData.slice(0, 110); // Show all 110 books
    const itemWidth = 200; // Fixed width for each carousel item
    const totalWidth = carouselBooks.length * itemWidth * 2; // *2 for duplication
    
    // Duplicate items for infinite scroll effect
    const duplicatedBooks = [...carouselBooks, ...carouselBooks];
    
    carousel.innerHTML = duplicatedBooks.map((book, index) => `
        <div class="carousel-item" onclick="window.location.hash='#/book/${book.id}'" style="width: ${itemWidth}px;">
            ${book.title}
        </div>
    `).join('');
    
    // Set total width for the carousel
    carousel.style.width = `${totalWidth}px`;
    
    // Start auto-scroll animation
    startCarouselAnimation(carousel, itemWidth);
}

function startCarouselAnimation(carousel, itemWidth) {
    if (carouselInterval) {
        cancelAnimationFrame(carouselInterval);
    }
    
    let position = 0;
    const speed = 0.5; // pixels per frame
    
    function animate() {
        position -= speed;
        
        // Reset position when we've scrolled through all items
        if (Math.abs(position) >= itemWidth * (booksData.length)) {
            position = 0;
        }
        
        carousel.style.transform = `translateX(${position}px)`;
        carouselInterval = requestAnimationFrame(animate);
    }
    
    carouselInterval = requestAnimationFrame(animate);
}

// ============= HELPER FUNCTIONS =============
function createBookCard(book) {
    return `
        <div class="book-card" onclick="window.location.hash='#/book/${book.id}'">
            <div class="book-cover">${book.title}</div>
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-author">by ${book.author}</div>
                <div class="book-rating">
                    <span class="stars">${renderStars(book.rating)}</span>
                    <span>(${book.rating})</span>
                </div>
                <div class="book-price">$${book.price}</div>
                <div class="book-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-primary" onclick="addToCart(${book.id})">Add to Cart</button>
                    <button class="btn btn-favorite ${isFavorite(book.id) ? 'active' : ''}" onclick="toggleFavorite(${book.id})">
                        ${isFavorite(book.id) ? '❤️' : '🤍'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
        stars += '★';
    }
    if (hasHalfStar) {
        stars += '☆';
    }
    while (stars.length < 5) {
        stars += '☆';
    }
    
    return stars;
}

function getGenreIcon(genre) {
    const icons = {
        "Children's Books": '👶',
        'Fiction': '📖',
        'Non-Fiction': '📚',
        'Science Fiction': '🚀',
        'Mystery & Thriller': '🔍',
        'Mystery &amp; Thriller': '🔍',
        'Romance': '💕',
        'Biography': '👤',
        'Fantasy': '🧙',
        'History': '⏳',
        'Classic Literature': '📜'
    };
    return icons[genre] || '📕';
}

function calculateAverageRating(book, userRating) {
    if (userRating > 0) {
        return ((parseFloat(book.rating) + userRating) / 2).toFixed(1);
    }
    return book.rating;
}

// ============= CART FUNCTIONS =============
function addToCart(bookId) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    const book = booksData.find(b => b.id === bookId);
    const quantityInput = document.getElementById('quantity');
    const quantity = quantityInput ? parseInt(quantityInput.value) : 1;
    
    const existingItem = cart.find(item => item.id === bookId);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            id: book.id,
            title: book.title,
            author: book.author,
            price: book.price,
            quantity: quantity
        });
    }
    
    saveToLocalStorage();
    updateCartCount();
    alert(`${book.title} added to cart!`);
}

function updateCartQuantity(bookId, change) {
    const item = cart.find(i => i.id === bookId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(bookId);
        } else {
            saveToLocalStorage();
            renderCheckoutPage();
        }
    }
}

function removeFromCart(bookId) {
    cart = cart.filter(item => item.id !== bookId);
    saveToLocalStorage();
    updateCartCount();
    renderCheckoutPage();
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;
}

function changeQuantity(change) {
    const input = document.getElementById('quantity');
    if (input) {
        let value = parseInt(input.value) + change;
        if (value < 1) value = 1;
        if (value > parseInt(input.max)) value = parseInt(input.max);
        input.value = value;
    }
}

function processPayment() {
    showPaymentModal();
}

function showPaymentModal() {
    document.getElementById('paymentModal').style.display = 'block';
}

function hidePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

function showSuccessModal() {
    const orderNumber = Math.floor(100000 + Math.random() * 900000);
    document.getElementById('orderNumber').textContent = orderNumber;
    document.getElementById('successModal').style.display = 'block';
}

function hideSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
}

function returnToHome() {
    hideSuccessModal();
    window.location.hash = '#/';
}

function completePayment(e) {
    e.preventDefault();
    
    // Validate card number format
    const cardNumber = document.getElementById('cardNumber').value;
    const expiry = document.getElementById('expiry').value;
    const cvv = document.getElementById('cvv').value;
    
    if (cardNumber.replace(/\s/g, '').length < 13) {
        alert('Please enter a valid card number');
        return;
    }
    
    if (!expiry.match(/^\d{2}\/\d{2}$/)) {
        alert('Please enter expiry date in MM/YY format');
        return;
    }
    
    if (cvv.length < 3) {
        alert('Please enter a valid CVV');
        return;
    }
    
    // Clear cart and show success
    cart = [];
    saveToLocalStorage();
    updateCartCount();
    
    hidePaymentModal();
    showSuccessModal();
    
    // Reset form
    document.getElementById('paymentForm').reset();
}

// ============= FAVORITES FUNCTIONS =============
function toggleFavorite(bookId) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    if (favorites.includes(bookId)) {
        favorites = favorites.filter(id => id !== bookId);
    } else {
        favorites.push(bookId);
    }
    
    saveToLocalStorage();
    renderCurrentPage();
}

function isFavorite(bookId) {
    return favorites.includes(bookId);
}

// ============= RATING FUNCTIONS =============
function rateBook(bookId, rating) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    userRatings[bookId] = rating;
    saveToLocalStorage();
    renderBookDetailPage(bookId);
}

// ============= SEARCH & FILTER =============
function performSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    if (!query) return;
    
    const results = booksData.filter(book => 
        book.title.toLowerCase().includes(query) || 
        book.author.toLowerCase().includes(query)
    );
    
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="container">
            <h1>Search Results for "${query}"</h1>
            ${results.length > 0 ? `
                <div class="books-grid">
                    ${results.map(book => createBookCard(book)).join('')}
                </div>
            ` : `
                <div class="empty-state">
                    <h2>No results found</h2>
                    <p>Try searching with different keywords</p>
                </div>
            `}
        </div>
    `;
}

function applySorting(genre) {
    const decodedGenre = decodeURIComponent(genre);
    const sortValue = document.getElementById('sortSelect').value;
    let genreBooks = booksData.filter(book => book.genre === decodedGenre);
    
    switch(sortValue) {
        case 'title':
            genreBooks.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'price-low':
            genreBooks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
            break;
        case 'price-high':
            genreBooks.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
            break;
        case 'rating':
            genreBooks.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
            break;
    }
    
    document.getElementById('genreBooksGrid').innerHTML = genreBooks.map(book => createBookCard(book)).join('');
}

// ============= THEME TOGGLE =============
function initializeTheme() {
    const savedTheme = localStorage.getItem('bookify_theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon();
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('bookify_theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
}

function updateThemeIcon() {
    const themeIcon = document.querySelector('.theme-icon');
    const isDark = document.body.classList.contains('dark-mode');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
}

// ============= AUTHENTICATION =============
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
}

function hideLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

function login(email, password) {
    // Mock authentication - accept any email/password
    currentUser = { email: email };
    saveToLocalStorage();
    updateLoginStatus();
    hideLoginModal();
    alert('Login successful!');
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        currentUser = null;
        cart = [];
        favorites = [];
        saveToLocalStorage();
        updateLoginStatus();
        updateCartCount();
        window.location.hash = '#/';
    }
}

function updateLoginStatus() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (currentUser) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
    } else {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
}

// ============= LOCAL STORAGE =============
function saveToLocalStorage() {
    localStorage.setItem('bookify_user', JSON.stringify(currentUser));
    localStorage.setItem('bookify_cart', JSON.stringify(cart));
    localStorage.setItem('bookify_favorites', JSON.stringify(favorites));
    localStorage.setItem('bookify_ratings', JSON.stringify(userRatings));
}

function loadFromLocalStorage() {
    const user = localStorage.getItem('bookify_user');
    const savedCart = localStorage.getItem('bookify_cart');
    const savedFavorites = localStorage.getItem('bookify_favorites');
    const savedRatings = localStorage.getItem('bookify_ratings');
    
    if (user) currentUser = JSON.parse(user);
    if (savedCart) cart = JSON.parse(savedCart);
    if (savedFavorites) favorites = JSON.parse(savedFavorites);
    if (savedRatings) userRatings = JSON.parse(savedRatings);
}

// ============= EVENT LISTENERS =============
function initializeEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Login modal
    document.getElementById('loginBtn').addEventListener('click', showLoginModal);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    document.querySelector('.close').addEventListener('click', hideLoginModal);
    
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        login(email, password);
    });
    
    // Payment modal
    document.getElementById('closePayment').addEventListener('click', hidePaymentModal);
    document.getElementById('paymentForm').addEventListener('submit', completePayment);
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        const loginModal = document.getElementById('loginModal');
        const paymentModal = document.getElementById('paymentModal');
        const successModal = document.getElementById('successModal');
        
        if (e.target === loginModal) {
            hideLoginModal();
        }
        if (e.target === paymentModal) {
            hidePaymentModal();
        }
        if (e.target === successModal) {
            hideSuccessModal();
        }
    });
    
    // Card number formatting
    document.addEventListener('input', (e) => {
        if (e.target.id === 'cardNumber') {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        }
        
        if (e.target.id === 'expiry') {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4);
            }
            e.target.value = value;
        }
        
        if (e.target.id === 'cvv') {
            e.target.value = e.target.value.replace(/\D/g, '');
        }
    });
    
    // Search
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Cart icon
    document.getElementById('cartIcon').addEventListener('click', () => {
        window.location.hash = '#/cart';
    });
}

// ============= UTILITIES =============
function showLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
}