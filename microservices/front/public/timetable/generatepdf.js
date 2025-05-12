function downloadDivAsPDF() {
    const { jsPDF } = window.jspdf;
    const element = document.getElementById("pdf-container");

    html2canvas(element, {
        scale: 2,            // reduced scale for better performance and smaller size
        useCORS: true,         // to handle cross-origin images
        allowTaint: true,      // allow tainted images
        logging: false         // disable logging for cleaner output
    }).then((canvas) => {
        const imgData = canvas.toDataURL("image/jpeg", 0.9);  // use JPEG format with 80% quality

        // get the actual dimensions of the div
        const imgWidth = canvas.width * 0.264583;  // px to mm
        const imgHeight = canvas.height * 0.264583;

        // create a PDF with the exact dimensions of the div in landscape mode
        const pdf = new jsPDF("l", "mm", [imgWidth, imgHeight]);

        // add the compressed image
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
        pdf.save("timetable.pdf");
    });
}
