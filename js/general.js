if (!localStorage.getItem('currentUser') && !window.location.pathname.endsWith('login.html')) {
    window.location.href = 'login.html';
}

// Real Time Clock
function updateClock() {
    const clockEl = document.getElementById('currentSystemClock');
    if (clockEl) {
        const now = new Date();
        clockEl.innerText = now.toLocaleString();
    }
}
setInterval(updateClock, 1000);
updateClock();

// User Name Display and Logout Session
const userDisplay = document.getElementById('sidebarUsername');
const storedUser = localStorage.getItem('currentUser');
if (userDisplay && storedUser) {
    userDisplay.innerText = storedUser;
}

//Back to Login Page
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        }
    });
}

// ==================== Load Live Weather Widget ====================
// Difference weather will have the difference message and icon following
function getWeatherDescription(code) {
    if (code === 0) 
        return { text: "Sunny Day", icon: "fa-sun", color: "#e0a800" };
    if (code >= 1 && code <= 3) 
        return { text: "Cloudy Day", icon: "fa-cloud-sun", color: "#38bdf8" };
    if (code >= 51 && code <= 67) 
        return { text: "Rainy Day", icon: "fa-cloud-rain", color: "#60a5fa" };
    if (code >= 95) 
        return { text: "Thunder Storm", icon: "fa-cloud-bolt", color: "#f87171" };
    return { text: "Fair", icon: "fa-cloud", color: "#94a3b8" };
}

function loadLiveWeather() {

    const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=4.5825&longitude=101.0948&current=temperature_2m,relative_humidity_2m,weather_code';

    fetch(weatherUrl)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const current = data.current;
                const units = data.current_units;
                const weatherEl = document.getElementById('weatherWidget');

                const weatherInfo = getWeatherDescription(current.weather_code);
                
                if (weatherEl) {
                    weatherEl.innerHTML = `
                        <b>Weather Info</b>
                        <i class="fa-solid fa-calendar" style="color: #093b85;"></i>
                        <br>
                        <i class="fa-solid fa-temperature-half" style="color: #e0a800;"></i> 
                        <b>Temperature : ${current.temperature_2m}${units.temperature_2m}</b> | 
                        <i class="fa-solid fa-droplet" style="color: #38bdf8;"></i> 
                        <b>Humidity : ${current.relative_humidity_2m}${units.relative_humidity_2m}</b> |
                        <i class="fa-solid ${weatherInfo.icon}" style="color: ${weatherInfo.color};"></i>
                        <b>Current Weather :${weatherInfo.text}</b>
                    `;
                }
            }
        })
        .catch(err => {
            console.warn('Could not load live weather:', err);
            const weatherEl = document.getElementById('weatherWidget');
            if (weatherEl) {
                weatherEl.innerHTML = '<span class="text-muted">Weather unavailable</span>';
            }
        });
}

loadLiveWeather();