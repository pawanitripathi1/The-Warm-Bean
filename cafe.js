const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'super-secret-barista-key', resave: false, saveUninitialized: true }));

// This uses your cloud database if available, and falls back to your local one for testing
// --- 1. CONNECT TO MONGODB ---
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/warmbean';
mongoose.connect(mongoURI)
    .then(() => console.log('✅ Connected to MongoDB!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- 2. DEFINE OUR DATABASE SCHEMAS (MODELS) ---
const menuSchema = new mongoose.Schema({ id: String, category: String, name: String, desc: String, price: Number, stockCount: Number });
const Menu = mongoose.model('Menu', menuSchema);

const orderSchema = new mongoose.Schema({ orderId: String, customer: String, item: String, price: Number, instructions: String, time: String, status: String, assignedBarista: String });
const Order = mongoose.model('Order', orderSchema);

const userSchema = new mongoose.Schema({ username: String, password: String, role: String, email: String, age: Number, lastLogin: Date });
const User = mongoose.model('User', userSchema);

// Automatically seed the expanded menu
const seedDatabase = async () => {
    const count = await Menu.countDocuments();
    if (count === 0) {
        await Menu.insertMany([
            { id: "espresso", category: "Hot Drinks", name: "Espresso", desc: "A strong, concentrated double shot.", price: 120, stockCount: 15 },
            { id: "vanilla-latte", category: "Hot Drinks", name: "Vanilla Latte", desc: "Espresso with steamed silky milk and vanilla.", price: 180, stockCount: 15 },
            { id: "dark-hot-chocolate", category: "Hot Drinks", name: "Belgian Hot Chocolate", desc: "Rich melted dark chocolate.", price: 195, stockCount: 15 },
            { id: "chamomile-tea", category: "Hot Drinks", name: "Chamomile Tea", desc: "Caffeine-free soothing floral tea.", price: 140, stockCount: 10 },
            { id: "nitro-cold-brew", category: "Cold Drinks", name: "Nitro Cold Brew", desc: "Velvety, creamy cold brew.", price: 220, stockCount: 10 },
            { id: "pesto-mozzarella-toastie", category: "Savory Bites", name: "Pesto & Mozzarella Toastie", desc: "Warm sourdough grilled with basil pesto.", price: 240, stockCount: 8 },
            { id: "butter-croissant", category: "Bakery", name: "Flaky Butter Croissant", desc: "Classic French pastry baked fresh.", price: 150, stockCount: 12 },
            { id: "fudge-brownie", category: "Bakery", name: "Warm Gooey Brownie", desc: "Decadent dark chocolate fudge brownie.", price: 170, stockCount: 10 }
        ]);
        console.log('🌱 Expanded Menu seeded into MongoDB!');
    }
};
seedDatabase();

// --- 3. STYLES & TEMPLATE ---
const aestheticStyles = `
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@500;700&display=swap');

        :root {
            --bg-cream: #FDFBF7;
            --surface-white: #FFFFFF;
            --dark-espresso: #2A1C14;
            --espresso-black: #1A110C;
            --caramel: #C88349;
            --latte: #E8D8C8;
            --mocha-text: #736357;
            --muted-sage: #5E6D55;
            --dark-sage: #45523E;
            --font-heading: 'Playfair Display', serif;
            --font-body: 'Outfit', sans-serif;
            --font-mono: 'JetBrains Mono', monospace;
            --shadow-soft: 0 15px 35px rgba(42, 28, 20, 0.06);
            --shadow-btn: 0 8px 20px rgba(200, 131, 73, 0.25);
        }

        body { background-color: var(--bg-cream); color: var(--dark-espresso); font-family: var(--font-body); margin: 0; padding: 0; display: flex; flex-direction: column; min-height: 100vh; -webkit-font-smoothing: antialiased; }
        h1, h2, h3, h4 { font-family: var(--font-heading); margin: 0; }
        a { text-decoration: none; }

        /* --- NAVBAR --- */
        .navbar { position: sticky; top: 0; z-index: 1000; background: rgba(253, 251, 247, 0.9); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid rgba(42, 28, 20, 0.05); padding: 0.8rem 2rem; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
        .nav-left, .nav-right { display: flex; align-items: center; flex: 1; }
        .nav-right { justify-content: flex-end; gap: 12px; }
        .nav-brand-container { opacity: 0; transform: translateX(-20px); transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1); pointer-events: none; }
        .nav-brand-container.show { opacity: 1; transform: translateX(0); pointer-events: auto; }
        .nav-brand-container a { font-family: var(--font-heading); font-size: 1.3rem; font-weight: 700; color: var(--dark-espresso); display: flex; align-items: center; gap: 6px; }
        .nav-center { display: flex; align-items: center; justify-content: center; gap: 15px; }
        .navbar a:not(.nav-brand-container a) { color: var(--mocha-text); font-size: 0.9rem; font-weight: 500; text-transform: uppercase; letter-spacing: 1.5px; transition: 0.3s ease; padding: 8px 12px; border-radius: 8px; }
        .navbar a:hover:not(.nav-brand-container a) { color: var(--caramel); background: rgba(200, 131, 73, 0.08); }
        .navbar a.nav-ai { color: var(--caramel); font-weight: 600; }
        .logout-icon { display: none; } /* Hidden on desktop */

        /* --- BOTTOM APP BAR (MOBILE ONLY) --- */
        .bottom-app-bar { display: none; } /* Hidden on desktop */

        /* --- EXPANDING NAV SEARCH --- */
        .nav-search { display: flex; align-items: center; background: transparent; border-radius: 50px; transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1); position: relative; }
        .nav-search-input { width: 0; padding: 0 !important; border: none !important; background: transparent !important; margin: 0 !important; opacity: 0; font-size: 0.9rem; transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1); color: var(--dark-espresso); box-shadow: none !important; }
        .nav-search-btn { background: transparent; border: none; font-size: 1.2rem; cursor: pointer; padding: 5px 8px; transition: 0.3s; color: var(--mocha-text); outline: none; }
        .nav-search:focus-within, .nav-search:hover { background: var(--surface-white); box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid var(--latte); }
        .nav-search:focus-within .nav-search-input, .nav-search:hover .nav-search-input { width: 140px; padding: 5px 10px 5px 15px !important; opacity: 1; }

        /* --- COZY CAFE HEADER --- */
        .header-banner { background: linear-gradient(135deg, var(--dark-espresso), var(--espresso-black)); color: var(--bg-cream); padding: 2.5rem 2rem 3.5rem 2rem; text-align: center; border-bottom: 3px dashed var(--caramel); }
        .header-banner h1 { font-size: 2.8rem; font-weight: 600; letter-spacing: -0.5px; }
        .header-banner h1 span { color: var(--caramel); }
        .header-tagline { font-size: 0.95rem; color: var(--latte); margin-top: 10px; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; }

        /* --- MAIN CONTAINER --- */
        .page-content { flex: 1; padding: 0 1.5rem 2rem 1.5rem; margin-top: -2rem; position: relative; z-index: 10; }
        .container { max-width: 800px; margin: 0 auto; background: var(--surface-white); padding: 2.5rem; border-radius: 24px; box-shadow: var(--shadow-soft); text-align: left; transition: max-width 0.3s ease; }
        .container.container--bare { background: transparent; box-shadow: none; padding: 0; max-width: 450px; text-align: center; }

        /* --- BUTTONS --- */
        .btn { background-color: var(--caramel); color: white; border: none; padding: 15px 32px; border-radius: 50px; font-size: 1rem; font-weight: 600; font-family: var(--font-body); cursor: pointer; display: inline-block; transition: 0.3s ease; box-shadow: var(--shadow-btn); text-align: center; }
        .btn:hover { background-color: var(--dark-espresso); transform: translateY(-3px); box-shadow: 0 12px 25px rgba(42, 28, 20, 0.2); }
        .btn-outline { background-color: transparent; color: var(--dark-espresso); border: 2px solid var(--caramel); box-shadow: none; }
        .btn-outline:hover { background-color: var(--caramel); color: white; }

        /* --- FORMS --- */
        input, select, textarea { width: 100%; box-sizing: border-box; padding: 15px 18px; border: 1.5px solid var(--latte); border-radius: 12px; font-family: var(--font-body); margin-bottom: 20px; font-size: 1rem; background: var(--bg-cream); color: var(--dark-espresso); transition: 0.3s ease; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: var(--caramel); box-shadow: 0 0 0 4px rgba(200, 131, 73, 0.15); background: var(--surface-white); }

        /* --- GRIDS & CARDS --- */
        .action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 1.5rem; }
        .action-card { background: var(--bg-cream); border: 1px solid var(--latte); padding: 2.5rem 1.5rem; border-radius: 20px; text-align: center; transition: 0.3s ease; color: inherit; }
        .action-card:hover { transform: translateY(-5px); border-color: var(--caramel); background: var(--surface-white); box-shadow: var(--shadow-soft); }
        .action-card h4 { font-size: 1.4rem; color: var(--dark-espresso); margin-bottom: 5px; }
        .action-card p { font-size: 0.9rem; color: var(--mocha-text); margin: 0; }

        .category-header { margin-top: 2.5rem; border-bottom: 2px solid var(--bg-cream); padding-bottom: 10px; font-size: 2rem; color: var(--dark-espresso); }
        .menu-link { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-radius: 16px; transition: 0.2s ease; border-bottom: 1px solid var(--bg-cream); gap: 15px; color: inherit; }
        .menu-link:hover { background-color: var(--bg-cream); transform: translateX(8px); }
        .menu-link.sold-out { opacity: 0.5; cursor: not-allowed; }
        .menu-link.sold-out:hover { transform: none; background: none; }
        .price { font-weight: 700; color: var(--caramel); font-size: 1.4rem; white-space: nowrap; }

        .ticket { background-color: var(--surface-white); border: 1px solid var(--latte); padding: 20px; margin-bottom: 15px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .ticket-header { display: flex; justify-content: space-between; border-bottom: 1px dashed var(--latte); padding-bottom: 12px; margin-bottom: 12px; font-weight: 600; font-size: 1.05rem;}

        .stats-grid { display: flex; flex-wrap: wrap; gap: 20px; background: var(--espresso-black); color: var(--bg-cream); padding: 30px; border-radius: 20px; margin-bottom: 30px; text-align: center; }
        .stat-box { flex: 1; min-width: 150px; }
        .stat-box h3 { font-size: 2.8rem; color: var(--caramel); margin: 0; }
        .stat-box p { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px; opacity: 0.8; }

        .dashboard-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; align-items: start; }
        .divider { margin: 30px 0; font-size: 0.9rem; color: var(--mocha-text); display: flex; align-items: center; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; }
        .divider::before, .divider::after { content: ""; flex: 1; border-bottom: 1px solid var(--latte); margin: 0 15px; }

        /* --- FOOTER --- */
        .site-footer { background-color: var(--espresso-black); color: var(--latte); padding: 4rem 2rem 1.5rem; margin-top: auto; }
        .footer-grid { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; text-align: left; margin-bottom: 3rem; }
        .footer-col h4 { color: var(--bg-cream); font-size: 1.5rem; margin-bottom: 1.2rem; }
        .footer-col p { color: var(--mocha-text); font-size: 0.95rem; line-height: 1.7; margin: 0; }
        .footer-bottom { border-top: 1px solid rgba(232, 216, 200, 0.1); padding-top: 1.5rem; text-align: center; font-size: 0.85rem; color: var(--mocha-text); }

        /* ==================================================
           📱 MOBILE RESPONSIVE BOTTOM NAV
           ================================================== */
        @media (max-width: 850px) {
            .dashboard-grid { grid-template-columns: 1fr; gap: 25px; }
        }
        
        @media (max-width: 650px) {
            body { padding-bottom: 70px; } /* Creates safe space so bottom nav doesn't cover footer */

            /* Tweak Top Navbar for Mobile */
            .navbar { padding: 10px 15px; }
            .nav-center { display: none; } /* Hide text links from top bar completely */
            .nav-brand-container { display: block; opacity: 1; transform: none; pointer-events: auto; }
            .nav-brand-container a { font-size: 1.1rem; }
            
            /* Swap 'Log Out' text for a sleek door icon to save space */
            .logout-text { display: none; }
            .logout-icon { display: inline; font-size: 1.2rem; }
            .nav-right { gap: 8px; }

            /* Bring in the Bottom App Bar */
            .bottom-app-bar {
                display: flex;
                justify-content: space-around;
                align-items: center;
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                background: rgba(253, 251, 247, 0.95);
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                border-top: 1px solid var(--latte);
                padding: 12px 0;
                padding-bottom: calc(12px + env(safe-area-inset-bottom));
                z-index: 1000;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.04);
            }
            .bottom-app-bar a {
                font-size: 1.6rem;
                text-decoration: none;
                padding: 8px 15px;
                border-radius: 12px;
                transition: 0.2s ease;
            }
            .bottom-app-bar a:active { transform: translateY(-3px); background: rgba(200, 131, 73, 0.1); }
            
            /* General Typography & Spacing */
            .header-banner { padding: 2rem 1rem 3.5rem 1rem; }
            .header-banner h1 { font-size: 2.2rem; }
            .header-tagline { font-size: 0.8rem; letter-spacing: 1px; }
            .page-content { padding: 0 1rem 2rem 1rem; margin-top: -1.5rem; }
            .container { padding: 1.5rem; border-radius: 16px; }
            
            .action-grid { grid-template-columns: 1fr; gap: 15px; }
            .action-card { padding: 1.5rem; }
            .menu-link { flex-direction: column; align-items: flex-start; gap: 8px; }
            .category-header { font-size: 1.6rem; margin-top: 1.5rem; }
            .ticket-header { flex-direction: column; align-items: flex-start; gap: 5px; }
            .stats-grid { flex-direction: column; padding: 20px; gap: 10px; }
            .stat-box h3 { font-size: 2.2rem; }
            
            .nav-search:focus-within .nav-search-input, 
            .nav-search:hover .nav-search-input { width: 100px; }
        }
    </style>
`;

const renderPage = (content, extraHead = '', hideNav = false) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>The Warm Bean</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>☕</text></svg>">
        ${aestheticStyles}
        ${extraHead}
    </head>
    <body>
        ${!hideNav ? `
        <!-- TOP NAVBAR -->
        <nav class="navbar" id="mainNav">
            <div class="nav-left">
                <div class="nav-brand-container" id="navBrand">
                    <a href="/home">☕ Warm Bean</a>
                </div>
            </div>
            
            <div class="nav-center">
                <a href="/home">Home</a>
                <a href="/menu">Menu</a>
                <a href="/history">Order History</a>
                <a href="/ai-barista" class="nav-ai">✨ AI Barista</a>
                <a href="/diy-cafe" style="font-size: 1.2rem; padding: 4px 8px;" title="Cafe at Home">🏠</a>
            </div>

            <div class="nav-right">
                <form action="/menu" method="GET" class="nav-search">
                    <input type="text" name="search" class="nav-search-input" placeholder="Search...">
                    <button type="submit" class="nav-search-btn" title="Search">🔍</button>
                </form>
                <a href="/wishlist" style="font-size: 1.2rem; padding: 5px 8px;" title="Wishlist">🤍</a>
                <a href="/logout" title="Log Out" style="padding: 5px 8px;">
                    <span class="logout-text">Log Out</span>
                    <span class="logout-icon">🚪</span>
                </a>
            </div>
        </nav>
        
        <!-- BOTTOM APP BAR (MOBILE ONLY) -->
        <nav class="bottom-app-bar">
            <a href="/home" title="Home">🏠</a>
            <a href="/menu" title="Menu">🥐</a>
            <a href="/ai-barista" title="AI Barista">✨</a>
            <a href="/diy-cafe" title="Cafe at Home">🍳</a>
            <a href="/history" title="History">📜</a>
        </nav>
        ` : ''}

        <header class="header-banner">
            <h1>The <span>Warm Bean</span></h1>
            <p class="header-tagline">Small-Batch Roasts · Poured With Intention</p>
        </header>

        <main class="page-content">
            <div class="container ${hideNav ? 'container--bare' : ''}">
                ${content}
            </div>
        </main>

        <footer class="site-footer">
            <div class="footer-grid">
                <div class="footer-col">
                    <h4>☕ The Warm Bean</h4>
                    <p>Roasted daily. Brewed by hand. Made for people who love genuinely good coffee.</p>
                </div>
                <div class="footer-col" style="text-align: right;">
                    <h4>Visit Us</h4>
                    <p>Open Daily: 7 AM - 9 PM<br>Free Wi-Fi & Cozy Seating</p>
                </div>
            </div>
            <div class="footer-bottom">
                &copy; ${new Date().getFullYear()} The Warm Bean Cafe. Designed for Coffee Lovers.
            </div>
        </footer>

        <script>
            window.addEventListener('scroll', () => {
                const navBrand = document.getElementById('navBrand');
                if(navBrand) {
                    if (window.scrollY > 120) {
                        navBrand.classList.add('show');
                    } else {
                        navBrand.classList.remove('show');
                    }
                }
            });
        </script>
    </body>
    </html>
`;

// --- 4. ASYNC DATABASE ROUTES ---
app.get('/', (req, res) => {
    res.send(renderPage(`
        <div class="gateway-card" style="background: var(--surface-white); padding: 3rem; border-radius: 20px; box-shadow: var(--shadow-soft);">
            <h3 style="font-size: 2rem; margin-bottom: 5px;">Login Portal</h3>
            <p style="color: var(--mocha-text); font-size: 0.95rem; margin-bottom: 25px;">Select your account type to proceed.</p>
            <select id="roleSelect" onchange="toggleView()">
                <option value="customer">I am a Customer</option>
                <option value="barista">I am a Barista</option>
            </select>

            <div id="customerForm">
                <form action="/auth/login" method="POST" style="text-align: left;">
                    <input type="hidden" name="role" value="customer">
                    <input type="text" name="username" placeholder="Your Name" required>
                    <input type="password" name="password" placeholder="Password" required>
                    <button type="submit" class="btn" style="width: 100%;">Sign In</button>
                </form>
                <div class="divider">OR</div>
                <a href="/register" class="btn btn-outline" style="width: 100%; box-sizing: border-box; text-align: center;">New here? Create an Account</a>
            </div>

            <div id="baristaForm" style="display: none;">
                <p style="font-size: 0.85rem; color: var(--mocha-text); margin-bottom: 15px;">Staff access requires authentication.</p>
                <form action="/auth/login" method="POST" style="text-align: left;">
                    <input type="hidden" name="role" value="barista">
                    <input type="text" name="username" placeholder="Barista Username" required>
                    <input type="password" name="password" placeholder="Password" required>
                    <button type="submit" class="btn" style="width: 100%; background: var(--dark-espresso);">Staff Sign In</button>
                </form>
            </div>
        </div>
        <script>
            function toggleView() {
                const isBarista = document.getElementById('roleSelect').value === 'barista';
                document.getElementById('customerForm').style.display = isBarista ? 'none' : 'block';
                document.getElementById('baristaForm').style.display = isBarista ? 'block' : 'none';
            }
        </script>
    `, '', true));
});

app.get('/register', (req, res) => {
    res.send(renderPage(`
        <div class="gateway-card" style="background: var(--surface-white); padding: 3rem; border-radius: 20px; box-shadow: var(--shadow-soft);">
            <h3 style="font-size: 2rem; margin-bottom: 5px;">Create Account</h3>
            <p style="color: var(--mocha-text); font-size: 0.95rem; margin-bottom: 25px;">Join Warm Bean to track orders or manage the cafe!</p>
            <form action="/auth/register" method="POST" style="text-align: left;">
                <select name="role" required>
                    <option value="customer">Register as Customer</option>
                    <option value="barista">Register as Barista</option>
                </select>
                <input type="text" name="username" placeholder="Choose a Username" required>
                <input type="email" name="email" placeholder="Email Address" required>
                <input type="number" name="age" placeholder="Age" min="13" max="120" required>
                <input type="password" name="password" placeholder="Password (Min 6 chars, letters & numbers)" required>
                <button type="submit" class="btn" style="width: 100%;">Register</button>
            </form>
            <div class="divider">OR</div>
            <a href="/" class="btn btn-outline" style="width: 100%; box-sizing: border-box; text-align: center;">Back to Login</a>
        </div>
    `, '', true));
});

app.post('/auth/register', async (req, res) => {
    const { username, email, age, password, role } = req.body;
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9]).{6,}$/;
    
    if (!passwordRegex.test(password)) {
        return res.send(renderPage(`
            <h2 style="text-align:center; color: #d9534f;">❌ Weak Password!</h2>
            <p style="text-align:center; color: var(--mocha-text); margin: 15px 0 25px;">Your password must be at least 6 characters long and contain both letters and numbers.</p>
            <div style="text-align:center;"><a href="/register" class="btn">Try Again</a></div>
        `, '', true));
    }

    let existingUser = await User.findOne({ email, role });
    if (existingUser) {
        return res.send(renderPage(`<h2 style="text-align:center; color: #d9534f;">❌ Email already taken!</h2><div style="text-align:center; margin-top: 25px;"><a href="/register" class="btn">Try a different email</a></div>`, '', true));
    }
    
    await User.create({ username, email, age, password, role, lastLogin: new Date() });
    req.session.username = username;
    req.session.role = role;

    if (role === 'barista') return res.redirect('/barista/home');
    res.redirect('/home');
});

app.post('/auth/login', async (req, res) => {
    const { username, password, role } = req.body;
    let existingUser = await User.findOne({ username, role });
    
    if (!existingUser) {
        return res.send(renderPage(`<h2 style="text-align:center; color: #d9534f;">❌ Account not found!</h2><div style="text-align:center; margin-top:25px;"><a href="/" class="btn">Try Again</a> or <a href="/register" class="btn btn-outline">Register Here</a></div>`, '', true));
    }
    
    if (existingUser.password !== password) {
        return res.send(renderPage(`<h2 style="text-align:center; color: #d9534f;">❌ Incorrect Password</h2><div style="text-align:center; margin-top:25px;"><a href="/" class="btn">Try Again</a></div>`, '', true));
    }
    
    existingUser.lastLogin = new Date();
    await existingUser.save();

    req.session.username = username;
    req.session.role = role;
    
    if (role === 'barista') return res.redirect('/barista/home');
    res.redirect('/home');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// --- THE HOME DASHBOARD ---
app.get('/home', (req, res) => {
    if (!req.session.username) return res.redirect('/');
    const name = req.session.username;
    res.send(renderPage(`
        <div style="text-align: center; margin-bottom: 2rem; padding-top: 1rem;">
            <h2 style="font-size: 2.2rem; color: var(--dark-espresso); font-family: var(--font-heading); margin: 0; font-weight: 600;">Good to see you, <span style="color: var(--caramel); font-style: italic;">${name}</span>.</h2>
            <p style="font-size: 1.05rem; color: var(--mocha-text); margin: 8px 0 0 0;">What are we brewing for you today?</p>
        </div>

        <div class="action-grid">
            <a href="/menu" class="action-card">
                <span style="font-size: 2.2rem; display: block; margin-bottom: 8px;">🥐</span>
                <h4>Explore Menu</h4>
                <p>Browse our seasonal drinks and food.</p>
            </a>
            <a href="/history" class="action-card">
                <span style="font-size: 2.2rem; display: block; margin-bottom: 8px;">📜</span>
                <h4>Your Orders</h4>
                <p>View your past favorites & live tickets.</p>
            </a>
            <a href="/diy-cafe" class="action-card">
                <span style="font-size: 2.2rem; display: block; margin-bottom: 8px;">🏠</span>
                <h4>Cafe at Home</h4>
                <p>AI recipes from your kitchen.</p>
            </a>
        </div>
    `));
});

app.get('/menu', async (req, res) => {
    if (!req.session.username) return res.redirect('/');
    
    const searchQuery = req.query.search ? req.query.search.toLowerCase() : '';
    const allMenu = await Menu.find({}).lean();
    
    const menu = searchQuery 
        ? allMenu.filter(item => item.name.toLowerCase().includes(searchQuery) || item.category.toLowerCase().includes(searchQuery))
        : allMenu;
    
    const renderCategory = (categoryName) => {
        const categoryItems = menu.filter(item => item.category === categoryName);
        if (categoryItems.length === 0) return '';
        let html = `<h3 class="category-header">${categoryName}</h3><div style="margin-top: 15px;">`;
        html += categoryItems.map(item => `
            <a href="${item.stockCount > 0 ? `/menu/${item.id}` : '#'}" class="menu-link ${item.stockCount <= 0 ? 'sold-out' : ''}">
                <div class="item-info">
                    <span style="font-size: 1.2rem; font-weight: 500; display: block; ${item.stockCount <= 0 ? 'text-decoration: line-through; color: #999;' : ''}">${item.name}</span>
                    <span style="font-size: 0.9rem; color: var(--mocha-text);">${item.desc}</span>
                </div>
                <span class="price">₹${item.price}</span>
            </a>
        `).join('');
        return html + `</div>`;
    };

    let pageHtml = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <h2 style="font-size: 3rem; margin: 0; color: var(--dark-espresso);">Our Menu</h2>
            <form action="/menu" method="GET" style="max-width: 400px; margin: 15px auto 0; position: relative;">
                <input type="text" name="search" value="${req.query.search || ''}" placeholder="Search menu..." autofocus style="padding-left: 45px; border-radius: 50px; margin-bottom: 0;">
                <span style="position: absolute; left: 18px; top: 14px; font-size: 1.2rem;">🔍</span>
            </form>
        </div>
    `;

    if (menu.length === 0) {
        pageHtml += `<div style="text-align: center; padding: 40px; color: var(--mocha-text);">No items matched your search. Try "Latte" or "Brownie"!</div>`;
    } else {
        pageHtml += renderCategory("Hot Drinks") + renderCategory("Cold Drinks") + renderCategory("Savory Bites") + renderCategory("Bakery");
    }

    res.send(renderPage(pageHtml));
});

app.get('/menu/:id', async (req, res) => {
    if (!req.session.username) return res.redirect('/');

    const item = await Menu.findOne({ id: req.params.id }).lean();
    if (!item || item.stockCount <= 0) return res.send(renderPage(`<h2>Item not available!</h2>`));

    const pendingCount = await Order.countDocuments({ status: { $ne: "Complete ✅" } });
    const savedName = req.session.username;

    const baristas = await User.find({ role: 'barista' }).lean();
    let baristaOptions = baristas.map(b => `<option value="${b.username}">${b.username}</option>`).join('');
    if (baristas.length === 0) baristaOptions = `<option value="Any">Any Available Barista</option>`;

    res.send(renderPage(`
        <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="font-size: 2.5rem; margin: 0;">${item.name}</h2>
            <span class="price" style="font-size: 2rem; display: block; margin-top: 5px;">₹${item.price}</span>
        </div>
        <form action="/api/order" method="POST" style="background: var(--bg-cream); padding: 2rem; border-radius: 16px; border: 1px solid var(--latte);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 0.95rem; background: var(--surface-white); padding: 15px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                <span style="color: var(--mocha-text);">Total Live Queue: <strong style="color: var(--caramel);">${pendingCount} orders ahead</strong></span>
            </div>
            
            <p style="margin: 0 0 8px; font-weight: 500;">Your Name:</p>
            <input type="text" name="customerName" required value="${savedName}" ${savedName ? 'readonly' : ''}>
            
            <p style="margin: 0 0 8px; font-weight: 500;">Select Your Barista:</p>
            <select name="assignedBarista" required>
                ${baristaOptions}
            </select>

            <p style="margin: 0 0 8px; font-weight: 500;">Special Instructions (Optional):</p>
            <textarea name="instructions" rows="2" placeholder="Extra hot, less ice, oat milk..."></textarea>
            
            <input type="hidden" name="itemId" value="${item.id}">
            <button type="submit" class="btn" style="width: 100%; margin-top: 10px; font-size: 1.1rem;">Place Order</button>
        </form>
    `));
});

app.post('/api/order', async (req, res) => {
    const item = await Menu.findOne({ id: req.body.itemId });
    
    if (item.stockCount <= 0) {
        return res.send(renderPage(`<h2 style="text-align:center; color:#d9534f;">❌ Sorry, the ${item.name} just sold out!</h2><div style="text-align:center; margin-top: 25px;"><a href="/menu" class="btn">Back to Menu</a></div>`, '', true));
    }

    item.stockCount -= 1;
    await item.save();

    const orderId = Math.floor(Math.random() * 10000).toString();
    
    await Order.create({
        orderId, customer: req.body.customerName, item: item.name, price: item.price,
        instructions: req.body.instructions || "None", time: new Date().toLocaleTimeString(),
        status: "Brewing ☕", assignedBarista: req.body.assignedBarista
    });
    
    res.redirect(`/track/${orderId}`);
});

app.get('/track/:id', async (req, res) => {
    const order = await Order.findOne({ orderId: req.params.id }).lean();
    if (!order) return res.send(renderPage(`<h2 style="text-align: center;">Order not found!</h2>`));

    const isComplete = order.status === "Complete ✅";
    const statusColor = isComplete ? "#4CAF50" : "var(--caramel)";
    const autoRefresh = !isComplete ? `<meta http-equiv="refresh" content="5;url=/track/${order.orderId}">` : '';

    res.send(renderPage(`
        <h2 style="text-align: center; font-size: 2.2rem;">Ticket #${order.orderId}</h2>
        <div style="border: 3px solid ${statusColor}; padding: 40px 20px; border-radius: 20px; margin: 30px 0; text-align: center; background: var(--surface-white);">
            <h3 style="color: ${statusColor}; font-size: 2.5rem;">${order.status}</h3>
        </div>
        <div style="text-align: left; background: var(--bg-cream); padding: 25px; border-radius: 16px; border: 1px solid var(--latte);">
            <p style="margin: 0 0 10px; font-size: 1.1rem;"><strong>Item:</strong> ${order.item}</p>
            <p style="margin: 0; color: var(--mocha-text);"><strong>Brewing by:</strong> ${order.assignedBarista || 'Any Barista'}</p>
        </div>
        ${isComplete ? `<div style="text-align:center; margin-top: 30px;"><a href="/home" class="btn">Back to Home</a></div>` : ''}
    `, autoRefresh));
});

app.get('/history', async (req, res) => {
    if (!req.session.username) {
        return res.send(renderPage(`<h2 style="text-align:center; color: #d9534f;">❌ Please log in first!</h2><div style="text-align:center; margin-top: 25px;"><a href="/" class="btn">Go to Login</a></div>`, '', true));
    }

    const currentCustomer = req.session.username;
    const userOrders = await Order.find({ customer: currentCustomer }).lean();

    let html = `
        <div style="text-align: center; margin-bottom: 2rem;">
            <h2 style="font-size: 3rem; margin: 0; color: var(--dark-espresso);">Your History</h2>
            <p style="margin-top: 10px; font-size: 1.1rem; color: var(--mocha-text);">Past orders for <strong>${currentCustomer}</strong></p>
        </div>
    `;

    if (userOrders.length === 0) {
        html += `<div class="ticket" style="text-align: center; padding: 50px 20px;"><p style="color: var(--mocha-text); font-size: 1.1rem; margin-bottom: 25px;">You haven't placed any orders yet!</p><a href="/menu" class="btn">Explore Menu</a></div>`;
    } else {
        userOrders.reverse().forEach(order => {
            const statusColor = order.status === "Complete ✅" ? "#4CAF50" : "var(--caramel)";
            html += `
                <div class="ticket" style="text-align: left;">
                    <div class="ticket-header">
                        <span style="font-size: 1.1rem;">Order #${order.orderId}</span>
                        <span style="color: ${statusColor}; font-weight: 700;">${order.status}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <p style="margin: 5px 0; font-size: 1.1rem; font-weight: 500;">${order.item}</p>
                            <p style="margin: 5px 0; font-size: 0.9rem; color: var(--mocha-text);">Brewed by: ${order.assignedBarista || 'Any Barista'}</p>
                            <p style="margin: 5px 0; font-size: 0.9rem; color: var(--mocha-text);">${order.time}</p>
                        </div>
                        <span class="price" style="font-size: 1.4rem;">₹${order.price}</span>
                    </div>
                </div>`;
        });
    }
    res.send(renderPage(html));
});

app.get('/wishlist', (req, res) => {
    if (!req.session.username) return res.redirect('/');
    res.send(renderPage(`
        <div style="text-align: center; padding: 3rem 0;">
            <h2 style="font-size: 2.5rem; color: var(--dark-espresso); margin-bottom: 15px;">🤍 Wishlist</h2>
            <p style="color: var(--mocha-text); font-size: 1.1rem; margin-bottom: 30px;">This feature is currently under construction!</p>
            <a href="/home" class="btn">Back to Home</a>
        </div>
    `));
});

// --- NEW FEATURE: CAFE AT HOME (DIY) ROUTES ---
app.get('/diy-cafe', (req, res) => {
    if (!req.session.username) return res.redirect('/');
    res.send(renderPage(`
        <div class="hero-section" style="padding-bottom: 0;">
            <h2 style="font-size: 2.8rem; margin-bottom: 5px;">🏠 Cafe at Home</h2>
            <p style="margin-bottom: 1.5rem;">Tell us what ingredients you have in your kitchen, and our AI Barista will give you a custom recipe!</p>
            <form action="/api/diy-recipe" method="POST" style="background: var(--surface-white); padding: 2rem; border-radius: 20px; box-shadow: var(--shadow-soft); text-align: left; border: 1px solid var(--latte);">
                <p style="margin: 0 0 10px; font-weight: 600; font-size: 1.1rem;">What's in your pantry?</p>
                <textarea name="ingredients" rows="3" placeholder="e.g., instant coffee, milk, sugar, cinnamon, ice..." required style="margin-bottom: 20px;"></textarea>
                <button type="submit" class="btn" style="width: 100%; font-size: 1.1rem;">Create My Recipe</button>
            </form>
        </div>
    `));
});

app.post('/api/diy-recipe', async (req, res) => {
    const userIngredients = req.body.ingredients;
    
    const prompt = `
    You are an expert barista. A customer wants to make a cafe-style drink at home.
    They have these ingredients: "${userIngredients}".
    Invent a delicious, creative coffee shop style drink they can make using ONLY (or mostly) these ingredients.
    
    Respond strictly in valid JSON format exactly like this:
    {
      "name": "Name of the custom drink",
      "description": "A mouth-watering 1-sentence description.",
      "steps": [
        "Step 1",
        "Step 2",
        "Step 3"
      ]
    }`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const data = JSON.parse(response.text);

        let stepsHtml = '<ol style="padding-left: 20px; color: var(--mocha-text); line-height: 1.8;">';
        data.steps.forEach(step => {
            stepsHtml += `<li style="margin-bottom: 10px;">${step}</li>`;
        });
        stepsHtml += '</ol>';

        res.send(renderPage(`
            <div style="text-align: center; max-width: 650px; margin: 0 auto;">
                <h2 style="color: var(--caramel); font-size: 2.8rem;">🏠 Your Home Cafe</h2>
                <p style="color: var(--mocha-text); font-size: 1.2rem; margin: 10px 0 30px 0;">We created something special just for you!</p>
                
                <div class="ticket" style="border-left: 5px solid var(--caramel); padding: 30px; box-shadow: 0 8px 25px rgba(0,0,0,0.04); text-align: left;">
                    <h3 style="font-size: 2rem; color: var(--dark-espresso); margin-bottom: 10px;">${data.name}</h3>
                    <p style="font-size: 1.05rem; color: var(--caramel); font-style: italic; margin-bottom: 25px;">${data.description}</p>
                    <h4 style="font-size: 1.2rem; border-bottom: 1px solid var(--latte); padding-bottom: 10px; margin-bottom: 15px;">How to make it:</h4>
                    ${stepsHtml}
                </div>
                
                <div style="margin-top: 40px;">
                    <a href="/diy-cafe" class="btn btn-outline" style="padding: 12px 35px;">Try Another Recipe</a>
                </div>
            </div>
        `));
    } catch (error) {
        console.error("AI Error:", error);
        res.send(renderPage(`<h2 style="text-align: center; color: #d9534f; font-size: 2rem;">Oops! Our AI barista couldn't parse your ingredients.</h2><div style="text-align: center; margin-top: 20px;"><a href="/diy-cafe" class="btn">Try again</a></div>`));
    }
});

// --- 5. BARISTA ROUTES ---
app.get('/barista/home', (req, res) => {
    if (req.session.role !== 'barista') return res.redirect('/');
    res.send(renderPage(`
        <div style="background: linear-gradient(135deg, var(--muted-sage), var(--dark-sage)); color: white; padding: 4rem 2rem; border-radius: 20px; text-align: center; box-shadow: var(--shadow-soft);">
            <h2 style="font-size: 1.5rem; margin-bottom: 10px; font-weight: 400; font-family: var(--font-body); opacity: 0.9;">Staff Portal</h2>
            <h2 style="font-size: 3.5rem; margin: 0;">Welcome on shift, ${req.session.username}!</h2>
        </div>
        <div style="text-align: center; margin-top: 40px;">
            <a href="/barista/dashboard" class="btn" style="padding: 18px 45px; font-size: 1.2rem; background: var(--muted-sage); box-shadow: 0 8px 20px rgba(94, 109, 85, 0.3);">Open Ticket Dashboard</a>
        </div>
    `, '', true)); 
});

app.get('/barista/dashboard', async (req, res) => {
    if (req.session.role !== 'barista') return res.redirect('/');

    const currentBarista = req.session.username;
    
    const baristaUser = await User.findOne({ username: currentBarista });
    const shiftStartTime = baristaUser && baristaUser.lastLogin ? baristaUser.lastLogin.getTime() : Date.now();

    const menu = await Menu.find({}).lean();
    const pendingOrders = await Order.find({ status: { $ne: "Complete ✅" }, assignedBarista: currentBarista }).lean();
    const completedOrders = await Order.find({ status: "Complete ✅", assignedBarista: currentBarista }).lean();
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.price, 0);

    let html = `
        <div style="text-align: center; margin-bottom: 15px;">
            <h2 style="font-size: 2.8rem; color: var(--dark-espresso); margin-bottom: 10px;">Station: ${currentBarista}</h2>
            <div style="display: inline-block; background: var(--bg-cream); border: 1px solid var(--latte); padding: 8px 20px; border-radius: 50px;">
                <p style="color: var(--mocha-text); font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 8px;">
                    ⏱️ Shift Timer: <strong id="shiftTimer" style="font-family: var(--font-mono); color: var(--caramel); font-size: 1.15rem; letter-spacing: 1px;">00:00:00</strong>
                </p>
            </div>
        </div>
        <div class="stats-grid" style="background: var(--espresso-black);">
            <div class="stat-box"><h3>₹${totalRevenue}</h3><p>Your Revenue</p></div>
            <div class="stat-box"><h3>${pendingOrders.length}</h3><p>Active Tickets</p></div>
        </div>
        
        <div class="dashboard-grid">
            <!-- LEFT COLUMN: TICKETS -->
            <div>
                <h2 style="font-size: 1.8rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">🔥 Live Queue</h2>
    `;

    if (pendingOrders.length === 0) {
        html += `<div style="text-align: center; padding: 30px; background: var(--bg-cream); border: 1px solid var(--latte); border-radius: 16px; margin-bottom: 40px;"><p style="color: var(--mocha-text); font-size: 1.1rem; margin: 0;">No tickets right now. Take a breather!</p></div>`;
    }

    pendingOrders.forEach(order => {
        html += `
            <div class="ticket" style="border-left: 4px solid var(--caramel);">
                <div class="ticket-header">
                    <span style="font-size: 1rem;">#${order.orderId} - <strong style="color: var(--dark-espresso); font-size: 1.1rem;">${order.customer}</strong></span>
                    <span style="color: var(--mocha-text); font-size: 0.9rem;">${order.time}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <p style="font-size: 1.3rem; margin: 0; font-weight: 600;">1x ${order.item}</p>
                    <form action="/api/complete" method="POST" style="margin: 0;">
                        <input type="hidden" name="orderId" value="${order.orderId}">
                        <button type="submit" class="btn" style="background: var(--muted-sage); padding: 10px 18px; font-size: 0.9rem; box-shadow: 0 4px 15px rgba(94, 109, 85, 0.2);">Ready ✔</button>
                    </form>
                </div>
                ${order.instructions && order.instructions !== "None" ? `<p style="margin-top: 12px; font-size: 0.9rem; color: #d9534f; background: rgba(217, 83, 79, 0.1); padding: 8px 12px; border-radius: 8px; font-weight: 500;"><strong>Note:</strong> ${order.instructions}</p>` : ''}
            </div>`;
    });

    html += `
            </div>
            
            <!-- RIGHT COLUMN: INVENTORY -->
            <div>
                <h2 style="font-size: 1.8rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">📦 Inventory</h2>
                <div style="background: var(--surface-white); padding: 20px; border-radius: 20px; border: 1px solid var(--latte); box-shadow: var(--shadow-soft);">
    `;
    
    menu.forEach(item => {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--bg-cream); padding-bottom: 12px;">
                <span style="font-size: 0.95rem; ${item.stockCount <= 0 ? 'color: #d9534f; text-decoration: line-through;' : 'font-weight: 500;'}">${item.name}</span>
                <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-cream); border-radius: 50px; padding: 2px;">
                    <form action="/api/update-stock" method="POST" style="margin:0;">
                        <input type="hidden" name="itemId" value="${item.id}">
                        <input type="hidden" name="change" value="-1">
                        <button type="submit" style="border: none; background: transparent; cursor: pointer; padding: 5px 12px; font-size: 1.2rem; color: var(--mocha-text); transition: 0.2s;">-</button>
                    </form>
                    <span style="font-weight: 700; width: 20px; text-align: center; font-size: 1rem;">${item.stockCount}</span>
                    <form action="/api/update-stock" method="POST" style="margin:0;">
                        <input type="hidden" name="itemId" value="${item.id}">
                        <input type="hidden" name="change" value="1">
                        <button type="submit" style="border: none; background: transparent; cursor: pointer; padding: 5px 12px; font-size: 1.2rem; color: var(--caramel); transition: 0.2s;">+</button>
                    </form>
                </div>
            </div>`;
    });

    html += `
                </div>
            </div>
        </div>
    `;

    const baristaHead = `
        <style>.container { max-width: 1000px !important; }</style>
        <meta http-equiv="refresh" content="10">
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                const startTime = ${shiftStartTime};
                function updateTimer() {
                    const now = Date.now();
                    const diff = Math.floor((now - startTime) / 1000);
                    const hrs = String(Math.floor(diff / 3600)).padStart(2, '0');
                    const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
                    const secs = String(diff % 60).padStart(2, '0');
                    const timerElement = document.getElementById('shiftTimer');
                    if(timerElement) timerElement.innerText = hrs + ':' + mins + ':' + secs;
                }
                setInterval(updateTimer, 1000);
                updateTimer(); 
            });
        </script>
    `;

    res.send(renderPage(html + `<div style="text-align: center; margin-top: 40px;"><a href="/logout" class="btn btn-outline" style="padding: 12px 30px;">End Shift (Log Out)</a></div>`, baristaHead, true));
});

app.post('/api/complete', async (req, res) => {
    await Order.updateOne({ orderId: req.body.orderId }, { status: "Complete ✅" });
    res.redirect('/barista/dashboard');
});

app.post('/api/update-stock', async (req, res) => {
    const changeAmount = parseInt(req.body.change);
    const item = await Menu.findOne({ id: req.body.itemId });
    
    if (item.stockCount === 0 && changeAmount === -1) {
        return res.redirect('/barista/dashboard');
    }

    item.stockCount += changeAmount;
    await item.save(); 
    res.redirect('/barista/dashboard');
});

// --- 6. AI BARISTA MATCHMAKER ---
app.get('/ai-barista', (req, res) => {
    if (!req.session.username) return res.redirect('/');
    
    res.send(renderPage(`
        <div class="hero-section" style="padding-bottom: 0;">
            <h2 style="font-size: 2.8rem; margin-bottom: 5px;">✨ AI Coffee Matchmaker</h2>
            <p style="margin-bottom: 1.5rem;">Tell us exactly what's going on. Stressed about exams? Just need a sugar rush?</p>
            <form action="/api/ask-ai" method="POST" style="background: var(--surface-white); padding: 2rem; border-radius: 20px; box-shadow: var(--shadow-soft); text-align: left; border: 1px solid var(--latte);">
                <p style="margin: 0 0 10px; font-weight: 600; font-size: 1.1rem;">What's the situation today?</p>
                <textarea name="situation" rows="3" placeholder="e.g., I've been studying for hours and I need something strong but sweet..." required style="margin-bottom: 20px;"></textarea>
                <button type="submit" class="btn" style="width: 100%; font-size: 1.1rem;">Find My Perfect Drink</button>
            </form>
        </div>
    `));
});

app.post('/api/ask-ai', async (req, res) => {
    const userSituation = req.body.situation;
    
    const inStockItems = await Menu.find({ stockCount: { $gt: 0 } }).lean();
    const menuString = inStockItems.map(item => `[ID: ${item.id}] ${item.name} - ₹${item.price}: ${item.desc}`).join('\n');

    const prompt = `
    You are an empathetic, expert barista at 'The Warm Bean'. 
    A customer just walked in and said: "${userSituation}"
    
    Here is our live menu:
    ${menuString}
    
    Pick the 2 absolute best items for their exact situation. 
    Respond strictly in valid JSON format exactly like this:
    {
      "message": "A friendly 1-sentence barista response acknowledging their specific situation.",
      "recommendations": [
        { "id": "exact_item_id_from_menu", "reason": "Short 1-sentence reason why this is perfect for them right now." }
      ]
    }`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const data = JSON.parse(response.text);

        let recommendedCards = '';
        data.recommendations.forEach(rec => {
            const item = inStockItems.find(i => i.id === rec.id);
            if (item) {
                recommendedCards += `
                    <div class="ticket" style="margin-top: 20px; border-left: 5px solid var(--caramel); padding: 25px; box-shadow: 0 8px 25px rgba(0,0,0,0.04);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="margin: 0; color: var(--dark-espresso); font-size: 1.4rem;">${item.name} — ₹${item.price}</h4>
                                <p style="margin: 8px 0; font-size: 0.95rem; color: var(--mocha-text); line-height: 1.5;">${rec.reason}</p>
                            </div>
                            <a href="/menu/${item.id}" class="btn" style="padding: 10px 22px; font-size: 0.95rem; margin-left: 20px; white-space: nowrap;">Order This</a>
                        </div>
                    </div>
                `;
            }
        });

        res.send(renderPage(`
            <div style="text-align: center;">
                <h2 style="color: var(--caramel); font-size: 2.8rem;">✨ Your Custom Picks</h2>
                <p style="color: var(--mocha-text); font-size: 1.2rem; margin: 20px 0 35px 0;">"${data.message}"</p>
                <div style="text-align: left;">
                    ${recommendedCards}
                </div>
                <div style="margin-top: 40px;">
                    <a href="/ai-barista" class="btn btn-outline" style="padding: 12px 35px;">Change Situation</a>
                </div>
            </div>
        `));

    } catch (error) {
        console.error("AI Error:", error);
        res.send(renderPage(`<h2 style="text-align: center; color: #d9534f; font-size: 2rem;">Oops! Our AI barista is taking a coffee break.</h2><div style="text-align: center; margin-top: 20px;"><a href="/ai-barista" class="btn">Try again later</a></div>`));
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));