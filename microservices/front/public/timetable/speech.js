document.addEventListener('DOMContentLoaded', function () {
    const micIcon = document.getElementById('mic-icon');
    const suggestionDetails = document.getElementById('suggestion-details');

    let recognition;
    let isListening = false;

    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.lang = 'ro-RO'; 
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            suggestionDetails.value = transcript;
        };

        recognition.onstart = function () {
            isListening = true;
            micIcon.classList.add('active');
            micIcon.classList.replace('fa-microphone', 'fa-microphone-alt');
        };

        recognition.onend = function () {
            isListening = false;
            micIcon.classList.remove('active');
            micIcon.classList.replace('fa-microphone-alt', 'fa-microphone');
        };

        recognition.onerror = function (event) {
            console.error('Speech recognition error:', event.error);
            alert('Error during speech recognition. Please try again.');
            isListening = false;
            micIcon.classList.remove('active');
        };

        micIcon.addEventListener('click', function () {
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else {
        alert('Your browser does not support speech recognition.');
    }
});
