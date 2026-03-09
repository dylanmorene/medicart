"""
MediCart Flask API
Reads from medicart.db (SQLite) and serves data to the React frontend.

Flow:
  1. POST /api/init-engine  — first dataset (gateway screen), iteration 1, no drift
  2. POST /api/upload       — 2nd dataset (dashboard), iteration 2, diffs vs iteration 1
  3. POST /api/upload       — 3rd dataset (dashboard), iteration 3, diffs vs iteration 2
"""

import sqlite3
import json
import os
import tempfile
from flask import Flask, jsonify, request
from flask_cors import CORS
import medicart_engine
from medicart_engine import load_transactions, run_pipeline, save_to_sqlite

app = Flask(__name__)
CORS(app)

try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:
    BASE_DIR = os.getcwd()

DB_PATH = os.path.join(BASE_DIR, "medicart.db")

# ── In-memory rule cache for drift chaining ───────────────────────────────────
# Survives within a server session; falls back to SQLite on restart
_rules_by_iteration = {}   # { 1: [...rules], 2: [...rules], ... }


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found at {DB_PATH}.")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_db_or_none():
    if not os.path.exists(DB_PATH):
        return None
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def parse_json_fields(rows, *fields):
    result = []
    for row in rows:
        d = dict(row)
        for field in fields:
            if field in d and d[field]:
                try:
                    d[field] = json.loads(d[field])
                except Exception:
                    pass
        result.append(d)
    return result

def get_current_iteration():
    conn = get_db_or_none()
    if conn is None:
        return 0
    c = conn.cursor()
    c.execute("SELECT MAX(iteration) FROM seasons")
    row = c.fetchone()
    conn.close()
    return row[0] if (row and row[0] is not None) else 0

def get_prev_rules_from_db():
    """
    Load the rules for the most recent season from SQLite.
    Used as fallback when _rules_by_iteration is empty (e.g. after server restart).
    """
    conn = get_db_or_none()
    if conn is None:
        return None
    c = conn.cursor()
    c.execute("SELECT season FROM seasons ORDER BY iteration DESC LIMIT 1")
    row = c.fetchone()
    if row is None:
        conn.close()
        return None
    latest_season = row[0]
    rules_rows = c.execute(
        "SELECT antecedent, consequent, support, confidence, lift, leverage, conviction, score "
        "FROM association_rules WHERE season=? ORDER BY score DESC",
        (latest_season,)
    ).fetchall()
    conn.close()
    rules = []
    for r in rules_rows:
        d = dict(r)
        d["antecedent"] = json.loads(d["antecedent"])
        d["consequent"] = json.loads(d["consequent"])
        rules.append(d)
    return rules if rules else None

def _ensure_tables(c):
    c.executescript("""
        CREATE TABLE IF NOT EXISTS seasons (
            season TEXT PRIMARY KEY,
            method TEXT, n_transactions INTEGER, n_itemsets INTEGER,
            n_rules INTEGER, minsup REAL, minconf REAL, iteration INTEGER,
            tagline TEXT, theme_color TEXT
        );
        CREATE TABLE IF NOT EXISTS homepage_ranking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT, rank INTEGER, item TEXT, frequency INTEGER, support REAL
        );
        CREATE TABLE IF NOT EXISTS all_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT, item TEXT, frequency INTEGER, support REAL
        );
        CREATE TABLE IF NOT EXISTS top_bundles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT, rank INTEGER, items TEXT, support_count INTEGER, support REAL
        );
        CREATE TABLE IF NOT EXISTS association_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT, antecedent TEXT, consequent TEXT, support REAL,
            confidence REAL, lift REAL, leverage REAL, conviction REAL, score REAL
        );
        CREATE TABLE IF NOT EXISTS frequently_bought_together (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT, bundle TEXT, support REAL, confidence REAL, lift REAL, score REAL
        );
        CREATE TABLE IF NOT EXISTS promo_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT, bundle TEXT, promo_type TEXT, suggested_discount TEXT,
            support REAL, confidence REAL, lift REAL, rationale TEXT
        );
        CREATE TABLE IF NOT EXISTS shelf_placement (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT, item_a TEXT, item_b TEXT, co_purchases INTEGER, insight TEXT
        );
        CREATE TABLE IF NOT EXISTS drift_report (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            season TEXT, drift_count INTEGER, new_count INTEGER,
            dropped_count INTEGER, new_rules TEXT, dropped_rules TEXT
        );
        CREATE TABLE IF NOT EXISTS version_cache (
            key TEXT PRIMARY KEY, season TEXT, iteration INTEGER,
            n_transactions INTEGER, minsup REAL, minconf REAL,
            n_itemsets INTEGER, n_rules INTEGER
        );
    """)

def _delete_season(c, season):
    for tbl in [
        "seasons", "homepage_ranking", "all_items", "top_bundles",
        "association_rules", "frequently_bought_together",
        "promo_recommendations", "shelf_placement", "drift_report",
    ]:
        try:
            c.execute(f"DELETE FROM {tbl} WHERE season=?", (season,))
        except Exception:
            pass

def _insert_season_data(c, season, result, theme_color, iteration):
    """Insert all results for one season into the open connection."""
    c.execute(
        "INSERT INTO seasons (season,method,n_transactions,n_itemsets,n_rules,minsup,minconf,iteration,tagline,theme_color) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            season, result.get("method", "Unknown"),
            result["n_transactions"], result["n_itemsets"], result["n_rules"],
            result["thresholds"]["minsup"], result["thresholds"]["minconf"],
            iteration, "User-uploaded dataset analysis", theme_color,
        ),
    )
    for rank, item in enumerate(result["homepage_ranking"], 1):
        c.execute("INSERT INTO homepage_ranking (season,rank,item,frequency,support) VALUES (?,?,?,?,?)",
                  (season, rank, item["item"], item["frequency"], item["support"]))
    for item in result["homepage_ranking"]:
        c.execute("INSERT INTO all_items (season,item,frequency,support) VALUES (?,?,?,?)",
                  (season, item["item"], item["frequency"], item["support"]))
    for rank, bundle in enumerate(result.get("top_bundles", []), 1):
        c.execute("INSERT INTO top_bundles (season,rank,items,support_count,support) VALUES (?,?,?,?,?)",
                  (season, rank, json.dumps(bundle["items"]), bundle["support_count"], bundle["support"]))
    for rule in result.get("top_rules", []):
        c.execute(
            "INSERT INTO association_rules "
            "(season,antecedent,consequent,support,confidence,lift,leverage,conviction,score) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (season, json.dumps(rule["antecedent"]), json.dumps(rule["consequent"]),
             rule["support"], rule["confidence"], rule["lift"],
             rule.get("leverage", 0), rule.get("conviction", 0), rule.get("score", 0)),
        )
    for fbt in result.get("frequently_bought_together", []):
        c.execute("INSERT INTO frequently_bought_together (season,bundle,support,confidence,lift,score) VALUES (?,?,?,?,?,?)",
                  (season, json.dumps(fbt["bundle"]), fbt["support"], fbt["confidence"], fbt["lift"], fbt.get("score", 0)))
    for promo in result.get("promo_recommendations", []):
        c.execute(
            "INSERT INTO promo_recommendations "
            "(season,bundle,promo_type,suggested_discount,support,confidence,lift,rationale) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (season, json.dumps(promo["bundle"]), promo["promo_type"], promo["suggested_discount"],
             promo["support"], promo["confidence"], promo["lift"], promo["rationale"]),
        )
    for shelf in result.get("shelf_placement", []):
        c.execute("INSERT INTO shelf_placement (season,item_a,item_b,co_purchases,insight) VALUES (?,?,?,?,?)",
                  (season, shelf["item_a"], shelf["item_b"], shelf["co_purchases"], shelf["insight"]))

    # Drift report — save even if drift_count is 0 (shows 0 shifted, N new, M dropped)
    dr = result.get("drift_report")
    if dr is not None:
        c.execute(
            "INSERT INTO drift_report (season,drift_count,new_count,dropped_count,new_rules,dropped_rules) "
            "VALUES (?,?,?,?,?,?)",
            (
                season, dr["drift_count"], dr["new_count"], dr["dropped_count"],
                json.dumps(dr.get("new_rules", [])), json.dumps(dr.get("dropped_rules", [])),
            ),
        )
        print(f"  Drift saved → shifted={dr['drift_count']} new={dr['new_count']} dropped={dr['dropped_count']}")

    # Version cache entry
    vc_key = f"{season}_v{iteration}"
    try:
        c.execute("INSERT OR REPLACE INTO version_cache VALUES (?,?,?,?,?,?,?,?)",
                  (vc_key, season, iteration, result["n_transactions"],
                   result["thresholds"]["minsup"], result["thresholds"]["minconf"],
                   result["n_itemsets"], result["n_rules"]))
    except Exception:
        pass


# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return jsonify({"status": "MediCart API running", "db": DB_PATH})

@app.route("/api/reset", methods=["POST"])
def reset_db():
    global _rules_by_iteration
    _rules_by_iteration = {}
    medicart_engine.VERSION_CACHE = {}
    try:
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/seasons")
def list_seasons():
    conn = get_db_or_none()
    if conn is None:
        return jsonify([])
    rows = conn.execute("SELECT season, theme_color, tagline FROM seasons ORDER BY iteration").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/seasons/<season>")
def get_season(season):
    conn = get_db()
    meta = conn.execute("SELECT * FROM seasons WHERE season=?", (season,)).fetchone()
    if not meta:
        return jsonify({"error": f"Season '{season}' not found"}), 404

    homepage  = conn.execute("SELECT * FROM homepage_ranking WHERE season=? ORDER BY rank", (season,)).fetchall()
    all_items = conn.execute("SELECT item,frequency,support FROM all_items WHERE season=? ORDER BY frequency DESC", (season,)).fetchall()
    bundles   = conn.execute("SELECT * FROM top_bundles WHERE season=? ORDER BY rank", (season,)).fetchall()
    rules     = conn.execute("SELECT * FROM association_rules WHERE season=? ORDER BY score DESC", (season,)).fetchall()
    fbt       = conn.execute("SELECT * FROM frequently_bought_together WHERE season=? ORDER BY score DESC", (season,)).fetchall()
    promos    = conn.execute("SELECT * FROM promo_recommendations WHERE season=?", (season,)).fetchall()
    shelf     = conn.execute("SELECT * FROM shelf_placement WHERE season=? ORDER BY co_purchases DESC", (season,)).fetchall()
    drift     = conn.execute("SELECT * FROM drift_report WHERE season=?", (season,)).fetchone()
    conn.close()

    return jsonify({
        "season": dict(meta),
        "homepage_ranking": [dict(r) for r in homepage],
        "all_items": [dict(r) for r in all_items],
        "top_bundles": parse_json_fields(list(bundles), "items"),
        "top_rules": parse_json_fields(list(rules), "antecedent", "consequent"),
        "frequently_bought_together": parse_json_fields(list(fbt), "bundle"),
        "promo_recommendations": parse_json_fields(list(promos), "bundle"),
        "shelf_placement": [dict(r) for r in shelf],
        "drift_report": parse_json_fields([dict(drift)], "new_rules", "dropped_rules")[0] if drift else None,
    })

@app.route("/api/versions")
def get_versions():
    conn = get_db()
    rows = conn.execute("SELECT * FROM version_cache ORDER BY iteration").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/rules/<season>")
def get_rules(season):
    conn = get_db()
    rows = conn.execute("SELECT * FROM association_rules WHERE season=? ORDER BY score DESC", (season,)).fetchall()
    conn.close()
    return jsonify(parse_json_fields(list(rows), "antecedent", "consequent"))

@app.route("/api/crosssell/<season>/<path:items>")
def get_crosssell(season, items):
    cart = [i.strip() for i in items.split(",")]
    conn = get_db()
    rules = conn.execute("SELECT * FROM association_rules WHERE season=? ORDER BY score DESC", (season,)).fetchall()
    conn.close()
    parsed = parse_json_fields(list(rules), "antecedent", "consequent")
    suggestions = [
        r for r in parsed
        if set(r["antecedent"]).issubset(set(cart)) and not set(r["consequent"]).issubset(set(cart))
    ]
    return jsonify(suggestions[:5])

@app.route("/api/update-season", methods=["POST"])
def update_season():
    data = request.json
    old_name = data.get("old_name")
    new_name = data.get("new_name")
    theme_color = data.get("theme_color")
    if not old_name or not new_name:
        return jsonify({"error": "Missing names"}), 400
    conn = get_db()
    c = conn.cursor()
    tables = [
        "seasons", "homepage_ranking", "all_items", "top_bundles",
        "association_rules", "frequently_bought_together",
        "promo_recommendations", "shelf_placement", "drift_report", "version_cache",
    ]
    try:
        if old_name != new_name:
            for tbl in tables:
                try:
                    c.execute(f"UPDATE {tbl} SET season=? WHERE season=?", (new_name, old_name))
                except Exception:
                    pass
        if theme_color:
            c.execute("UPDATE seasons SET theme_color=? WHERE season=?", (theme_color, new_name))
        conn.commit()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
    return jsonify({"success": True})

# ── INIT ENGINE — first dataset ───────────────────────────────────────────────

@app.route("/api/init-engine", methods=["POST"])
def init_engine():
    """Gateway screen: first dataset, iteration 1, no drift."""
    global _rules_by_iteration
    if "file" not in request.files:
        return jsonify({"error": "Missing file"}), 400
    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "No file selected"}), 400

    tpath = tempfile.mktemp(suffix=".csv")
    f.save(tpath)
    try:
        _rules_by_iteration = {}
        medicart_engine.VERSION_CACHE = {}

        txns = load_transactions(tpath)
        result = run_pipeline("Base", txns, iteration=1, prev_rules=None)

        # Cache rules for next upload
        _rules_by_iteration[1] = result["all_rules"]

        all_results = {"Base": result, "_version_cache": medicart_engine.VERSION_CACHE}
        save_to_sqlite(all_results, DB_PATH)

        print(f"  Init engine done. Rules cached for iteration 1: {len(result['all_rules'])}")
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tpath):
            os.remove(tpath)

    return jsonify({"success": True})

# ── UPLOAD — 2nd, 3rd datasets ────────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
def upload_csv():
    """
    Dashboard upload button: each upload is one more iteration.
    Automatically computes drift against the previous iteration's rules.
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    dataset_name = request.form.get("dataset_name", "").strip() or "Custom Dataset"
    theme_color  = request.form.get("theme_color", "#4b5563").strip()

    tpath = tempfile.mktemp(suffix=".csv")
    file.save(tpath)
    try:
        txns = load_transactions(tpath)

        # Determine iteration number
        current_iter = get_current_iteration()
        new_iter = current_iter + 1

        # Get previous rules — in-memory first, then SQLite fallback
        prev_rules = _rules_by_iteration.get(current_iter)
        if prev_rules is None:
            prev_rules = get_prev_rules_from_db()

        print(f"\n[Upload] '{dataset_name}' | iter={new_iter} | prev_rules={len(prev_rules) if prev_rules else 0}")

        # Run pipeline WITH prev_rules so drift is computed
        result = run_pipeline(dataset_name, txns, iteration=new_iter, prev_rules=prev_rules)

        # Cache this iteration's rules for the next upload
        _rules_by_iteration[new_iter] = result["all_rules"]

        # Write to SQLite
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        _ensure_tables(c)
        _delete_season(c, dataset_name)
        _insert_season_data(c, dataset_name, result, theme_color, new_iter)
        conn.commit()
        conn.close()

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(tpath):
            os.remove(tpath)

    return jsonify({"success": True, "season": dataset_name, "iteration": new_iter})


# ── RUN ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n MediCart Flask API")
    print(f" Database: {DB_PATH}")
    print(" Flow:")
    print("   Step 1  POST /api/init-engine   Upload dataset_a_rainy.csv (gateway)")
    print("   Step 2  POST /api/upload        Upload dataset_b_summer.csv (dashboard)")
    print("   Step 3  POST /api/upload        Upload dataset_c_holiday.csv (dashboard)")
    print(" Running at http://localhost:5001\n")
    app.run(debug=True, port=5001)