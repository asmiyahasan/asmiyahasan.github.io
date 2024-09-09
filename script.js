document.addEventListener('DOMContentLoaded', () => {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const close = document.querySelector('.close');

    document.querySelectorAll('.gallery-image').forEach(img => {
        img.addEventListener('click', (e) => {
            lightbox.style.display = 'flex';
            lightboxImg.src = e.target.src;
        });
    });

    close.addEventListener('click', () => {
        lightbox.style.display = 'none';
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            lightbox.style.display = 'none';
        }
    });
});

document.addEventListener('scroll', function () {
    var sections = document.querySelectorAll('.main');
    var navLinks = document.querySelectorAll('#menu ul li a');

    sections.forEach(function (section) {
        var top = section.offsetTop;
        var height = section.offsetHeight;
        var id = section.getAttribute('id');
        var navLink = document.querySelector('a[href="#' + id + '"]');

        if (window.scrollY >= top && window.scrollY < top + height) {
            navLink.classList.add('active');
        } else {
            navLink.classList.remove('active');
        }
    });
});