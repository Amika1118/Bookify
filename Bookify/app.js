// Bookify - Complete Online Bookstore Application

// ============= DATA STORAGE =============
let booksData = [];
let currentUser = null;
let carouselInterval = null;
let cart = [];
let favorites = [];
let userRatings = {};
let usersData = [];
let currentQuantity = 1;

// ============= INITIALIZATION =============
document.addEventListener('DOMContentLoaded', async () => {
    // First load from localStorage
    loadFromLocalStorage();
    initializeTheme();
    
    // Initialize event listeners first so they're ready
    initializeEventListeners();
    
    // Then load data
    await loadBooksData();
    loadUsersData();
    
    // Initialize router and UI
    initializeRouter();
    updateCartCount();
    updateLoginStatus();
    
    // Initial page render
    renderCurrentPage();
});

// ============= XML DATA LOADING =============
async function loadBooksData() {
    showLoading(true);
    try {
        // Load XML file
        const response = await fetch('books.xml');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const xmlText = await response.text();
        
        // Fix common XML issues before parsing
        const fixedXmlText = xmlText
            .replace(/&(?!amp;|lt;|gt;|quot;|#39;|#x27;)/g, '&amp;') // Fix unescaped ampersands
            .replace(/<price>(\d+\.\d+)<\/price>\s*<price>(\d+\.\d+)<\/price>/g, '<price>$1</price>'); // Remove duplicate price tags
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fixedXmlText, 'text/xml');
        
        // Check for XML parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            console.warn('XML parsing warnings:', parserError.textContent);
            // Continue anyway - we'll parse what we can
        }
        
        booksData = parseXMLBooks(xmlDoc);
        
        console.log('Total books loaded:', booksData.length);
        const genres = [...new Set(booksData.map(book => book.genre))];
        console.log('Genres found:', genres);
        
        showLoading(false);
    } catch (error) {
        console.error('Error loading books:', error);
        showLoading(false);
        // Fallback to sample data if XML fails
        booksData = getSampleBooks();
        renderCurrentPage();
    }
}

// Sample fallback books if XML fails
function getSampleBooks() {
    return [
        {
            id: 1,
            title: "Where the Wild Things Are",
            author: "Maurice Sendak",
            genre: "Children's Books",
            price: "18.95",
            rating: "4.9",
            description: "A classic children's book about imagination and adventure.",
            stock: 120
        },
        {
            id: 2,
            title: "The Very Hungry Caterpillar",
            author: "Eric Carle",
            genre: "Children's Books",
            price: "10.99",
            rating: "4.9",
            description: "The story of a caterpillar's transformation into a butterfly.",
            stock: 200
        },
        {
            id: 3,
            title: "Charlotte's Web",
            author: "E.B. White",
            genre: "Children's Books",
            price: "14.99",
            rating: "4.8",
            description: "A heartwarming tale of friendship between a pig and a spider.",
            stock: 85
        },
        {
            id: 4,
            title: "Goodnight Moon",
            author: "Margaret Wise Brown",
            genre: "Children's Books",
            price: "8.99",
            rating: "4.8",
            description: "A soothing bedtime classic for toddlers.",
            stock: 150
        }
    ];
}

async function loadUsersData() {
    try {
        const response = await fetch('users.xml');
        if (!response.ok) return;
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const userNodes = xmlDoc.getElementsByTagName('user');
        usersData = Array.from(userNodes).map(user => ({
            email: user.getElementsByTagName('email')[0]?.textContent || '',
            password: user.getElementsByTagName('password')[0]?.textContent || ''
        }));
    } catch (error) {
        console.log('No users XML found, starting fresh');
    }
}

function parseXMLBooks(xmlDoc) {
    const books = [];
    // Handle both <book> tags directly under root or nested
    let bookNodes = xmlDoc.getElementsByTagName('book');
    
    // If no books found, try different approach
    if (bookNodes.length === 0) {
        // Try to get books from bookstore element
        const bookstore = xmlDoc.querySelector('bookstore');
        if (bookstore) {
            bookNodes = bookstore.getElementsByTagName('book');
        }
    }
    
    console.log('Total book nodes found:', bookNodes.length);
    
    for (let i = 0; i < bookNodes.length; i++) {
        const book = bookNodes[i];
        
        try {
            // Get the ID from the attribute
            const idAttr = book.getAttribute('id');
            let id;
            if (idAttr) {
                id = parseInt(idAttr);
            } else {
                // Try to get ID from text content
                const idElement = book.querySelector('id');
                if (idElement) {
                    id = parseInt(idElement.textContent) || (i + 1);
                } else {
                    id = i + 1;
                }
            }
            
            // Get title - try multiple selectors
            let title = '';
            const titleElement = book.querySelector('title');
            if (titleElement) {
                title = titleElement.textContent?.trim() || `Book ${id}`;
            } else {
                title = `Book ${id}`;
            }
            
            // Get author
            let author = '';
            const authorElement = book.querySelector('author');
            if (authorElement) {
                author = authorElement.textContent?.trim() || 'Unknown Author';
            } else {
                author = 'Unknown Author';
            }
            
            // Get genre
            let genre = '';
            const genreElement = book.querySelector('genre');
            if (genreElement) {
                genre = genreElement.textContent?.trim() || 'General';
                // Decode HTML entities
                genre = decodeHTMLEntities(genre);
            } else {
                genre = 'General';
            }
            
            // Get price - handle multiple price tags
            let price = '9.99';
            const priceElements = book.querySelectorAll('price');
            if (priceElements.length > 0) {
                // Use the first price element
                price = priceElements[0].textContent?.trim() || '9.99';
                // Clean price string
                price = price.replace(/[^\d.]/g, '');
                if (!price || isNaN(parseFloat(price))) {
                    price = '9.99';
                }
            }
            
            // Get rating
            let rating = '3.0';
            const ratingElement = book.querySelector('rating');
            if (ratingElement) {
                rating = ratingElement.textContent?.trim() || '3.0';
                rating = parseFloat(rating).toFixed(1);
            }
            
            // Get description
            let description = '';
            const descriptionElement = book.querySelector('description');
            if (descriptionElement) {
                description = descriptionElement.textContent?.trim() || 
                             `${title} is a captivating ${genre.toLowerCase()} book.`;
            } else {
                description = `${title} is a captivating ${genre.toLowerCase()} book.`;
            }
            
            // Get stock
            let stock = 50;
            const stockElements = book.querySelectorAll('stock');
            if (stockElements.length > 0) {
                const stockText = stockElements[0].textContent?.trim();
                if (stockText && !isNaN(parseInt(stockText))) {
                    stock = parseInt(stockText);
                }
            }
            
            books.push({
                id: id,
                title: title,
                author: author,
                genre: genre,
                price: parseFloat(price).toFixed(2),
                rating: rating,
                description: description,
                stock: stock
            });
            
            console.log(`Parsed book ${id}: ${title} - ${genre}`);
            
        } catch (error) {
            console.error(`Error parsing book ${i + 1}:`, error);
            // Skip this book but continue with others
            continue;
        }
    }
    
    // Sort books by ID to maintain order
    books.sort((a, b) => a.id - b.id);
    
    console.log('Successfully parsed', books.length, 'books');
    return books;
}

// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
    if (!text) return '';
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

// ============= ROUTER =============
function initializeRouter() {
    // Initial render
    setTimeout(() => {
        renderCurrentPage();
    }, 100);
    
    window.addEventListener('hashchange', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        renderCurrentPage();
    });
}

function renderCurrentPage() {
    const hash = window.location.hash || '#/';
    
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (hash === '#/' || hash === '' || hash === '#') {
        renderHomePage();
    } else if (hash.startsWith('#/book/')) {
        const bookId = parseInt(hash.split('/')[2]);
        renderBookDetailPage(bookId);
    } else if (hash.startsWith('#/genre/')) {
        const genre = decodeURIComponent(hash.split('/')[2]);
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
    
    // Only render carousel if we have books
    if (booksData.length > 0) {
        renderCarousel();
    }
}

// ============= PAGE RENDERERS =============
function renderHomePage() {
    const mainContent = document.getElementById('mainContent');
    
    // Show loading if books not loaded yet
    if (booksData.length === 0) {
        mainContent.innerHTML = `
            <div class="container">
                <div class="hero">
                    <h1>Welcome to Bookify</h1>
                    <p>Loading books...</p>
                </div>
            </div>
        `;
        return;
    }
    
    // Get unique genres and sort them
    const allGenres = booksData.map(book => book.genre);
    const uniqueGenres = [...new Set(allGenres)].sort();
    
    console.log('Rendering home page with genres:', uniqueGenres);
    
    // Take up to 16 featured books, but ensure we have some
    const featuredBooks = booksData.slice(0, Math.min(16, booksData.length));
    
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
            
            ${featuredBooks.length > 0 ? `
                <div class="books-section">
                    <h2>Featured Books</h2>
                    <div class="books-grid books-grid-four">
                        ${featuredBooks.map(book => createBookCard(book)).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function renderGenrePage(genre) {
    const mainContent = document.getElementById('mainContent');
    
    // Decode URI component first, then HTML entities
    let decodedGenre = decodeURIComponent(genre);
    decodedGenre = decodeHTMLEntities(decodedGenre);
    
    const genreBooks = booksData.filter(book => book.genre === decodedGenre);
    
    console.log(`Rendering genre page for: ${decodedGenre}, found ${genreBooks.length} books`);
    
    if (genreBooks.length === 0) {
        mainContent.innerHTML = `
            <div class="container">
                <h1>${decodedGenre}</h1>
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
            <h1>${decodedGenre}</h1>
            
            <div class="filters">
                <h3>Filter & Sort</h3>
                <div class="filter-group">
                    <label>Sort by:</label>
                    <select id="sortSelect" onchange="applySorting('${encodeURIComponent(decodedGenre)}')">
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
                        <input type="number" id="quantity" value="${currentQuantity}" min="1" max="${book.stock}">
                        <button onclick="changeQuantity(1)">+</button>
                    </div>
                    
                    <div class="book-actions">
                        <button class="btn btn-primary" onclick="addToCart(${book.id})">Add to Cart</button>
                        <button class="btn btn-favorite ${isFavorite(book.id) ? 'active' : ''}" onclick="toggleFavorite(${book.id})">
                            ${isFavorite(book.id) ? '❤️' : '♡'}
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
            <h1>Checkout</h1>
            
            <div class="checkout-steps">
                <div class="step active">Cart</div>
                <div class="step">Payment</div>
                <div class="step">Confirmation</div>
            </div>
            
            ${cart.length > 0 ? `
                <div class="checkout-layout">
                    <div class="checkout-left">
                        <div class="cart-section">
                            <h2>Your Cart (${cart.length} item${cart.length !== 1 ? 's' : ''})</h2>
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
                                                <span>${item.quantity}</span>
                                                <button onclick="updateCartQuantity(${item.id}, 1)">+</button>
                                                <button class="btn btn-remove" onclick="removeFromCart(${item.id})">Remove</button>
                                            </div>
                                        </div>
                                        <div class="cart-item-total">
                                            <strong>$${(parseFloat(item.price) * item.quantity).toFixed(2)}</strong>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="payment-section" id="paymentSection">
                            <h2>Payment Details</h2>
                            <form id="paymentForm">
                                <div class="form-group">
                                    <label for="cardName">Cardholder Name</label>
                                    <input type="text" id="cardName" required placeholder="John Doe">
                                </div>
                                
                                <div class="form-group">
                                    <label for="cardNumber">Card Number</label>
                                    <input type="text" id="cardNumber" required placeholder="1234 5678 9012 3456" maxlength="19">
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="expiry">Expiry Date</label>
                                        <input type="text" id="expiry" required placeholder="MM/YY" maxlength="5">
                                    </div>
                                    <div class="form-group">
                                        <label for="cvv">CVV</label>
                                        <input type="text" id="cvv" required placeholder="123" maxlength="3">
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <div class="checkout-right">
                        <div class="order-summary">
                            <h2>Order Summary</h2>
                            <div class="summary-details">
                                <div class="summary-row">
                                    <span>Subtotal:</span>
                                    <span>$${subtotal.toFixed(2)}</span>
                                </div>
                                <div class="summary-row">
                                    <span>Shipping:</span>
                                    <span>Free</span>
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
                            
                            <button class="btn btn-primary btn-block" onclick="completePayment()">Complete Purchase</button>
                            <button class="btn btn-block" onclick="window.location.hash='#/'">Continue Shopping</button>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="empty-state">
                    <h2>Your cart is empty</h2>
                    <p>Add some books to get started!</p>
                    <button class="btn btn-primary" onclick="window.location.hash='#/'">Browse Books</button>
                </div>
            `}
        </div>
    `;
    
    // Initialize card input formatting
    initializeCardInputs();
}

function renderConfirmationPage() {
    const orderNumber = Math.floor(100000 + Math.random() * 900000);
    
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
        <div class="container">
            <div class="confirmation-page">
                <div class="confirmation-icon">✓</div>
                <h1>Payment Successful!</h1>
                <p>Thank you for your purchase. Your order has been confirmed.</p>
                
                <div class="order-details">
                    <div class="detail-row">
                        <span>Order Number:</span>
                        <strong>#${orderNumber}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Date:</span>
                        <span>${new Date().toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span>Email:</span>
                        <span>${currentUser.email}</span>
                    </div>
                </div>
                
                <div class="confirmation-actions">
                    <button class="btn btn-primary" onclick="window.location.hash='#/'">Continue Shopping</button>
                    <button class="btn" onclick="window.print()">Print Receipt</button>
                </div>
            </div>
        </div>
    `;
}

function renderCarousel() {
    const carousel = document.getElementById('bookCarousel');
    if (!carousel) return;
    
    const carouselBooks = booksData.slice(0, Math.min(50, booksData.length));
    const itemWidth = 200;
    const totalWidth = carouselBooks.length * itemWidth * 2;
    
    const duplicatedBooks = [...carouselBooks, ...carouselBooks];
    
    carousel.innerHTML = duplicatedBooks.map((book, index) => `
        <div class="carousel-item" onclick="window.location.hash='#/book/${book.id}'" style="width: ${itemWidth}px;">
            <div class="carousel-title">${book.title}</div>
            <div class="carousel-author">by ${book.author}</div>
        </div>
    `).join('');
    
    carousel.style.width = `${totalWidth}px`;
    
    startCarouselAnimation(carousel, itemWidth);
}

function startCarouselAnimation(carousel, itemWidth) {
    if (carouselInterval) {
        cancelAnimationFrame(carouselInterval);
    }
    
    let position = 0;
    const speed = 0.5;
    
    function animate() {
        position -= speed;
        
        if (Math.abs(position) >= itemWidth * (booksData.slice(0, 50).length)) {
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
                        ${isFavorite(book.id) ? '❤️' : '♡'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderStars(rating) {
    const numRating = parseFloat(rating);
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 >= 0.5;
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
        'Romance': '💕',
        'Biography': '👤',
        'Fantasy': '🧙',
        'History': '⏳',
        'Classic Literature': '📜',
        'General': '📕'
    };
    
    // Check for exact match first
    if (icons[genre]) {
        return icons[genre];
    }
    
    // Check for partial matches
    if (genre.includes('Children')) return '👶';
    if (genre.includes('Fiction')) return '📖';
    if (genre.includes('Non-Fiction')) return '📚';
    if (genre.includes('Science') || genre.includes('Sci-Fi')) return '🚀';
    if (genre.includes('Mystery') || genre.includes('Thriller')) return '🔍';
    if (genre.includes('Romance')) return '💕';
    if (genre.includes('Biography') || genre.includes('Memoir')) return '👤';
    if (genre.includes('Fantasy')) return '🧙';
    if (genre.includes('History')) return '⏳';
    if (genre.includes('Classic')) return '📜';
    
    return '📕';
}

function calculateAverageRating(book, userRating) {
    const bookRating = parseFloat(book.rating) || 3.0;
    if (userRating > 0) {
        return ((bookRating + userRating) / 2).toFixed(1);
    }
    return bookRating.toFixed(1);
}

// ============= CART FUNCTIONS =============
function addToCart(bookId) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    const book = booksData.find(b => b.id === bookId);
    if (!book) {
        alert('Book not found!');
        return;
    }
    
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
        currentQuantity = value;
    }
}

function initializeCardInputs() {
    const cardNumber = document.getElementById('cardNumber');
    const expiry = document.getElementById('expiry');
    const cvv = document.getElementById('cvv');
    
    if (cardNumber) {
        cardNumber.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        });
    }
    
    if (expiry) {
        expiry.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4);
            }
            e.target.value = value;
        });
    }
    
    if (cvv) {
        cvv.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

function completePayment() {
    const cardNumber = document.getElementById('cardNumber')?.value;
    const expiry = document.getElementById('expiry')?.value;
    const cvv = document.getElementById('cvv')?.value;
    const cardName = document.getElementById('cardName')?.value;
    
    if (!cardName || !cardNumber || !expiry || !cvv) {
        alert('Please fill in all payment details');
        return;
    }
    
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
    
    // Process payment
    cart = [];
    saveToLocalStorage();
    updateCartCount();
    
    // Show confirmation page
    renderConfirmationPage();
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
    
    if (window.location.hash === '#/favorites') {
        renderCurrentPage();
    } else {
        // Update all favorite buttons on the page
        const buttons = document.querySelectorAll('.btn-favorite');
        buttons.forEach(button => {
            const onclick = button.getAttribute('onclick');
            if (onclick && onclick.includes('toggleFavorite')) {
                const match = onclick.match(/toggleFavorite\((\d+)\)/);
                if (match) {
                    const id = parseInt(match[1]);
                    button.classList.toggle('active', isFavorite(id));
                    button.innerHTML = isFavorite(id) ? '❤️' : '♡';
                }
            }
        });
    }
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
        book.author.toLowerCase().includes(query) ||
        book.genre.toLowerCase().includes(query)
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
    const normalizedGenre = decodeHTMLEntities(decodedGenre);
    const sortValue = document.getElementById('sortSelect').value;
    let genreBooks = booksData.filter(book => book.genre === normalizedGenre);
    
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

// ============= AUTHENTICATION FUNCTIONS =============
function hashPassword(password) {
    // Simple hash function for demo (use bcrypt in production)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

function validateUser(email, password) {
    const hashedPassword = hashPassword(password);
    return usersData.find(user => 
        user.email === email && user.password === hashedPassword
    );
}

function userExists(email) {
    return usersData.some(user => user.email === email);
}

function showLoginModal() {
    document.getElementById('authModal').style.display = 'block';
    switchToLogin();
}

function hideAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    clearAuthForms();
}

function switchToLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'none';
    document.querySelector('.auth-title').textContent = 'Login to Bookify';
    clearAuthForms();
}

function switchToSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('resetForm').style.display = 'none';
    document.querySelector('.auth-title').textContent = 'Create Account';
    clearAuthForms();
}

function switchToReset() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('resetForm').style.display = 'block';
    document.querySelector('.auth-title').textContent = 'Reset Password';
    clearAuthForms();
}

function clearAuthForms() {
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('signupEmail').value = '';
    document.getElementById('signupPassword').value = '';
    document.getElementById('resetEmail').value = '';
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    const user = validateUser(email, password);
    if (user) {
        currentUser = { email: email };
        saveToLocalStorage();
        updateLoginStatus();
        hideAuthModal();
        alert('Login successful!');
    } else {
        alert('Invalid email or password');
    }
}

function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!email || !password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    if (userExists(email)) {
        alert('Email already registered');
        return;
    }
    
    // For demo, we'll just add to the local array
    // In a real app, this would save to the XML file via a backend
    usersData.push({ email, password: hashPassword(password) });
    alert('Account created successfully! Please login.');
    switchToLogin();
}

function handleResetPassword(e) {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;
    
    if (!email) {
        alert('Please enter your email');
        return;
    }
    
    if (!userExists(email)) {
        alert('Email not found');
        return;
    }
    
    alert('Password reset link has been sent to your email (demo)');
    switchToLogin();
}

function login(email, password) {
    currentUser = { email: email };
    saveToLocalStorage();
    updateLoginStatus();
    hideAuthModal();
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
    // Theme toggle - wait for element to exist
    setTimeout(() => {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }
    }, 100);
    
    // Auth buttons using event delegation
    document.addEventListener('click', (e) => {
        if (e.target.id === 'loginBtn') {
            showLoginModal();
        }
        if (e.target.id === 'logoutBtn') {
            logout();
        }
        if (e.target.id === 'closeAuth') {
            hideAuthModal();
        }
        if (e.target.id === 'searchBtn') {
            performSearch();
        }
        if (e.target.id === 'cartIcon') {
            window.location.hash = '#/cart';
        }
    });
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }
    
    // Auth forms
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', handleResetPassword);
    }
    
    // Switch auth forms
    document.addEventListener('click', (e) => {
        if (e.target.id === 'switchToSignup') {
            e.preventDefault();
            switchToSignup();
        }
        if (e.target.id === 'switchToLogin') {
            e.preventDefault();
            switchToLogin();
        }
        if (e.target.id === 'switchToReset') {
            e.preventDefault();
            switchToReset();
        }
        if (e.target.id === 'switchToLoginFromReset') {
            e.preventDefault();
            switchToLogin();
        }
        if (e.target.id === 'switchToLoginFromSignup') {
            e.preventDefault();
            switchToLogin();
        }
    });
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        const authModal = document.getElementById('authModal');
        if (e.target === authModal) {
            hideAuthModal();
        }
    });
}

// ============= UTILITIES =============
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
}