"""Luas Live Assistant: a small Flask app and same-origin proxy for Luas XML."""

from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import os

from flask import Flask, jsonify, make_response, request, send_from_directory

app = Flask(__name__, static_folder=None)

API_URL = "http://luasforecasts.rpa.ie/xml/get.ashx"
API_TIMEOUT_SECONDS = 10

# Official Luas stop abbreviations. The lines are used to label stops in the UI.
STOPS = {
    "ABB": ("Abbey Street", "Red"), "BAL": ("Balally", "Green"),
    "BAW": ("Ballyogan Wood", "Green"), "BEE": ("Beechwood", "Green"),
    "BEL": ("Belgard", "Red"), "BLA": ("Blackhorse", "Red"),
    "BLU": ("Bluebell", "Red"), "BRI": ("Brides Glen", "Green"),
    "BRD": ("Broadstone – University", "Green"), "BRO": ("Broombridge", "Green"),
    "BUS": ("Busáras", "Red"), "CAB": ("Cabra", "Green"),
    "CCK": ("Carrickmines", "Green"), "CPK": ("Central Park", "Green"),
    "CHA": ("Charlemont", "Green"), "CVN": ("Cheeverstown", "Red"),
    "CHE": ("Cherrywood", "Green"), "CIT": ("Citywest Campus", "Red"),
    "CON": ("Connolly", "Red"), "COO": ("Cookstown", "Red"),
    "COW": ("Cowper", "Green"), "DAW": ("Dawson", "Green"),
    "DOM": ("Dominick", "Green"), "DRI": ("Drimnagh", "Red"),
    "DUN": ("Dundrum", "Green"), "FAT": ("Fatima", "Red"),
    "FET": ("Fettercairn", "Red"), "FOR": ("Fortunestown", "Red"),
    "FOU": ("Four Courts", "Green"), "GDK": ("George's Dock", "Red"),
    "GLE": ("Glencairn", "Green"), "GOL": ("Goldenbridge", "Red"),
    "GRA": ("Grangegorman", "Green"), "HAR": ("Harcourt", "Green"),
    "HEU": ("Heuston", "Red"), "HOS": ("Hospital", "Red"),
    "JAM": ("James's", "Red"), "JER": ("Jervis", "Red"),
    "KIL": ("Kilmacud", "Green"), "KIN": ("Kingswood", "Red"),
    "KYL": ("Kylemore", "Red"), "LAU": ("Laughanstown", "Green"),
    "LEO": ("Leopardstown Valley", "Green"), "MAR": ("Marlborough", "Green"),
    "MYS": ("Mayor Square – NCI", "Red"), "MIL": ("Milltown", "Green"),
    "MUS": ("Museum", "Red"), "OGP": ("O'Connell – GPO", "Green"),
    "OUP": ("O'Connell – Upper", "Green"), "PAR": ("Parnell", "Green"),
    "PHI": ("Phibsborough", "Green"), "RAN": ("Ranelagh", "Green"),
    "RED": ("Red Cow", "Red"), "RIA": ("Rialto", "Red"),
    "SAG": ("Saggart", "Red"), "SAN": ("Sandyford", "Green"),
    "SMI": ("Smithfield", "Green"), "SDK": ("Spencer Dock", "Red"),
    "STS": ("St. Stephen's Green", "Green"), "STI": ("Stillorgan", "Green"),
    "SUI": ("Suir Road", "Red"), "TAL": ("Tallaght", "Red"),
    "GAL": ("The Gallops", "Green"), "TPT": ("The Point", "Red"),
    "TRY": ("Trinity", "Green"), "WES": ("Westmoreland", "Green"),
    "WIN": ("Windy Arbour", "Green"),
}


@app.get("/")
def index():
    response = send_from_directory(os.path.dirname(os.path.abspath(__file__)), "index.html")
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/<path:asset>")
def static_asset(asset):
    """Serve the two front-end assets without introducing another dependency."""
    if asset not in {"style.css", "script.js"}:
        return jsonify({"error": "Not found."}), 404
    response = send_from_directory(os.path.dirname(os.path.abspath(__file__)), asset)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/stops")
def stops():
    """Return stop metadata to populate the selector."""
    rows = [{"code": code, "name": name, "line": line}
            for code, (name, line) in STOPS.items()]
    rows.sort(key=lambda row: (row["line"], row["name"]))
    return jsonify(rows)


@app.get("/api/forecast")
def forecast():
    """Fetch and return the official raw XML forecast for one valid stop."""
    code = request.args.get("stop", "").strip().upper()
    if code not in STOPS:
        return jsonify({"error": "Choose a valid Luas stop."}), 400

    query = urlencode({"action": "forecast", "stop": code, "encrypt": "false"})
    upstream = Request(
        f"{API_URL}?{query}",
        headers={"User-Agent": "LuasLiveAssistant/1.0", "Accept": "application/xml,text/xml"},
    )
    try:
        with urlopen(upstream, timeout=API_TIMEOUT_SECONDS) as response:
            xml_bytes = response.read()
            if not xml_bytes.strip():
                raise ValueError("The Luas API returned an empty response.")
            result = make_response(xml_bytes, 200)
            # The upstream currently serves XML with a text/html content type.
            # Label its unchanged XML body accurately for browser clients.
            result.headers["Content-Type"] = "application/xml; charset=utf-8"
            result.headers["Cache-Control"] = "no-store"
            return result
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
        app.logger.warning("Luas API request failed for %s: %s", code, error)
        return jsonify({
            "error": "Live Luas data is temporarily unavailable. Please try again shortly.",
            "detail": str(error),
        }), 502


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=False)
