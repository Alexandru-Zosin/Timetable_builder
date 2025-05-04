function downloadDivAsPDF() {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById("pdf-container");

    html2canvas(element, {
        scale: 2,            // Reduced scale for better performance and smaller size
        useCORS: true,         // To handle cross-origin images
        allowTaint: true,      // Allow tainted images
        logging: false         // Disable logging for cleaner output
    }).then((canvas) => {
        const imgData = canvas.toDataURL("image/jpeg", 0.9);  // Use JPEG format with 80% quality

        // Get the actual dimensions of the div
        const imgWidth = canvas.width * 0.264583;  // px to mm
        const imgHeight = canvas.height * 0.264583;

        // Create a PDF with the exact dimensions of the div in landscape mode
        const pdf = new jsPDF("l", "mm", [imgWidth, imgHeight]);

        // Add the compressed image
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
        pdf.save("timetable.pdf");
    });
}
