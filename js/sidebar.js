// js/sidebar.js

document.addEventListener('DOMContentLoaded', () => {
    const sidebarHTML = `
        <aside class="side">
            <div class="logo">Ad Astra</div>
            <a class="n" href="index.html" id="link-home">Home</a>
            <a class="n" href="prompt-gallery.html" id="link-gallery">Prompt Gallery</a>
            <!-- Future links (e.g., href="characters.html") will go here -->
        </aside>
    `;

    // Inject the HTML into the container
    document.getElementById('sidebar-container').innerHTML = sidebarHTML;

    // Highlight the active page based on the current file URL
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage === 'index.html' || currentPage === '') {
        document.getElementById('link-home').classList.add('on');
    } else if (currentPage === 'prompt-gallery.html') {
        document.getElementById('link-gallery').classList.add('on');
    }
});