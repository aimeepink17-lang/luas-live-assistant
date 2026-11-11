# myLUAS

The complete application is the self-contained `index.html` file: markup, styling, and JavaScript are all inline. It fetches the official class stop list and live forecasts directly from the lecturer-provided API, groups stops by line, remembers the selected stop, and refreshes every 20 seconds.

Open `index.html` through the existing GitHub Pages site. The Pages workflow publishes only this file. Forecast responses use the API's `stopName`, `message`, `created`, `directions`, `destination`, and `due` fields. A `due` value of zero is shown as “Due”. API failures appear in a visible alert.

No Flask, Python runtime, Cloudflare Worker, API key, JavaScript framework, CSS file, or stop-data file is required by the application.

Footer attribution in the app: “Data: Transport Infrastructure Ireland. Built by Aimee for BDAIB.”
