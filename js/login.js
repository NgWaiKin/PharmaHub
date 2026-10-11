// 1. LOGIN FUNCTION 
async function handleLogin(username, password) {
    try{
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success){
            localStorage.setItem('currentUser', data.user.username);
            
            // Store user session data in browser's sessionStorage
            sessionStorage.setItem('userId', data.user.user_id);
            sessionStorage.setItem('userRole', data.user.role);

            // Redirect to the index page
            window.location.href = 'index.html';
        }
        else{
            alert(data.message);
        }
    }
    catch (error){
        console.error('Network or server error:', error);
        alert('Failed to connect to the server.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm'); // Change to your form ID

    if (loginForm){
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent page refresh

            const usernameInput = document.getElementById('loginUsername').value.trim();
            const passwordInput = document.getElementById('loginPassword').value;

            // Call the handleLogin function
            await handleLogin(usernameInput, passwordInput);
        });
    }
});