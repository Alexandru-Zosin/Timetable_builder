const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const weatherIcons = {
  sunny: '<i class="fa-solid fa-sun"></i>',
  cloudy: '<i class="fa-solid fa-cloud"></i>',
  rainy: '<i class="fa-solid fa-cloud-rain"></i>',
  snow: '<i class="fa-solid fa-snowflake"></i>',
  thunderstorm: '<i class="fa-solid fa-bolt"></i>',
  foggy: '<i class="fa-solid fa-smog"></i>',
  clear: '<i class="fa-solid fa-moon"></i>',
};

const getWeatherIcon = (description) => {
  if ([0, 1].some((el) => description.includes(el)))
    return weatherIcons.sunny;
  if ([3].some((el) => description.includes(el)))
    return weatherIcons.cloudy;
  if ([61, 63].some((el) => description.includes(el)))
    return weatherIcons.rainy;
  if ([85, 86].some((el) => description.includes(el)))
    return weatherIcons.snow;
  if ([95, 96].some((el) => description.includes(el)))
    return weatherIcons.thunderstorm;
  if ([45, 48].some((el) => description.includes(el)))
    return weatherIcons.foggy;
  return weatherIcons.clear;
};

async function fetchWeather() {
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=47.173&longitude=27.574&daily=weathercode,temperature_2m_max&timezone=Europe/Bucharest'
    );
    const data = await response.json();
    const dailyForecast = data.daily;

    const today = new Date();
    const startOfWeek = today.getDate() - today.getDay() + 1;

    const filteredForecast = weekdays.map((_, index) => {
      const forecastDay = new Date(today.getFullYear(), today.getMonth(), startOfWeek + index);
      const dayIndex = forecastDay.getDay() - 1;
      return {
        day: weekdays[index],
        temperature: Math.round(dailyForecast.temperature_2m_max[dayIndex]),
        icon: getWeatherIcon(dailyForecast.weathercode[dayIndex].toString()),
      };
    });

    renderWeather(filteredForecast);
  } catch (error) {
    console.error('Error fetching weather:', error);
  }
}

function renderWeather(forecast) {
  const timetable = document.getElementById('timetable');
  const dayHeaders = timetable.querySelectorAll('.day-header');

  forecast.forEach((day, index) => {
    const weatherDiv = document.createElement('div');
    weatherDiv.className = 'weather';
    weatherDiv.innerHTML = `${day.icon} <span>${day.temperature}°C</span>`;
    dayHeaders[index].appendChild(weatherDiv);
  });
}

fetchWeather();