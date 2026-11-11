# Luas Live Assistant

A small chatbot-style web app for checking real-time Luas arrival forecasts. The interface is written in HTML, CSS and browser JavaScript. A lightweight Flask server serves the app and proxies forecast requests to the official Luas RPA HTTP API. No OpenAI key or other API key is required.

## Features

- Red Line and Green Line stop selector.
- Chat-style questions such as “When is the next tram from Ranelagh?”
- Forecast destinations and arrival estimates are displayed only when returned by the live XML API.
- Manual refresh and a local “last refreshed” timestamp.
- Clear unavailable-data messages when the upstream API cannot be reached.

## Architecture

1. `index.html` contains the page structure and accessible controls.
2. `style.css` provides the responsive visual design.
3. `script.js` loads stop metadata from Flask, sends selected stop codes to `/api/forecast`, parses the returned XML in the browser and renders forecasts.
4. `app.py` serves the web app, validates stop codes, calls the Luas endpoint and returns its raw XML response. This same-origin proxy also avoids browser mixed-content and CORS restrictions.

The upstream request has this form:

```text
http://luasforecasts.rpa.ie/xml/get.ashx?action=forecast&stop=RAN&encrypt=false
```

The XML parser reads the live response's `stopInfo`, `message`, `direction`, and `tram` elements. Each `tram` supplies its destination and `dueMins` estimate as attributes; the direction name comes from its containing `direction` element. The parser was checked against a genuine response from the official API. It does not generate, estimate or cache arrival times. If the API changes its XML format, the parser in `script.js` should be updated to match a newly inspected response; an unrecognized response is reported without inventing a forecast.

## Run locally

Python 3.9 or newer is recommended.

### Windows PowerShell

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000). Keep the terminal running while using the app. If the official service is unavailable, forecasts show a clear error and can be retried with **Refresh**.

## API and attribution

Forecast data is requested from Transport Infrastructure Ireland / RPA’s Luas Forecasting API:

- Endpoint: [http://luasforecasts.rpa.ie/xml/get.ashx](http://luasforecasts.rpa.ie/xml/get.ashx)
- Example query: `?action=forecast&stop=RAN&encrypt=false`
- API information and example: [data.gov.ie — Luas Forecasting API](https://data.gov.ie/dataset/luas-forecasting-api)
- The dataset is published under the [Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/).

Attribution: **Luas forecast information provided by Transport Infrastructure Ireland (TII), via the RPA Luas Forecasting API. Licensed under CC BY 4.0.** Stop names and codes are included to support selection. This college project is not an official Luas application.
