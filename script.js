// Get the menu button and menu element
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('menu');

// Create a custom cursor element
const cursor = document.createElement('div');
cursor.classList.add('custom-cursor');
document.body.appendChild(cursor);

// Update cursor position based on mouse movement
document.addEventListener('mousemove', (event) => {
    const x = event.clientX;
    const y = event.clientY;
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
});

// Add a hover effect when the mouse is over specific elements
document.querySelectorAll('a, button, .hover-target').forEach(element => {
    element.addEventListener('mouseover', () => {
        cursor.classList.add('hover');
    });
    element.addEventListener('mouseout', () => {
        cursor.classList.remove('hover');
    });
});