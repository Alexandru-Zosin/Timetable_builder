export function showAlert({ text, timer = 2000 }) {
    Swal.fire({
        text,
        scrollbarPadding: false, // disables default padding adjustment
        customClass: {
            popup: 'custom-swal'
        },
        showConfirmButton: false,
        timer
    });
}